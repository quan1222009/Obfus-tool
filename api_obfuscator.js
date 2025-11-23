const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json()); 

// --- 1. Cấu hình Luaparse an toàn ---
let luaparse;
try {
    luaparse = require('luaparse');
} catch (e) {
    console.error("CẢNH BÁO: Chưa cài luaparse. Chạy 'npm install luaparse'");
}

// --- 2. Cấu hình Biến và Hàm bổ trợ ---
const identifierMap = new Map();
const LUA_GLOBALS = new Set([
    'print', 'wait', 'game', 'script', 'workspace', 'math', 'string', 'table', 
    'require', 'local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do',
    'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'pairs', 'ipairs', 'next', 
    'tostring', 'tonumber', 'pcall', 'xpcall', 'select', 'unpack', 'Instance', 'Vector3', 'CFrame'
]);

const generateRandomIdentifier = () => '_' + Math.random().toString(36).substring(2, 9);

// --- 3. Hàm Mã hóa XOR (Dùng Buffer chuẩn Node.js) ---
const xorEncrypt = (text, key) => {
    if (!text) return "";
    const keyBytes = Buffer.from(key, 'utf-8');
    const textBytes = Buffer.from(text, 'utf-8');
    const encryptedBytes = Buffer.alloc(textBytes.length);

    for (let i = 0; i < textBytes.length; i++) {
        encryptedBytes[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return encryptedBytes.toString('base64');
};

// --- 4. Logic Duyệt AST để Đổi tên biến ---
function traverseAndRename(node) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'Identifier') {
        const oldName = node.name;
        if (!LUA_GLOBALS.has(oldName)) {
            if (!identifierMap.has(oldName)) {
                identifierMap.set(oldName, generateRandomIdentifier());
            }
            node.name = identifierMap.get(oldName);
        }
        return;
    }
    
    for (const key in node) {
        if (node.hasOwnProperty(key)) {
            const child = node[key];
            if (Array.isArray(child)) {
                child.forEach(traverseAndRename);
            } else {
                traverseAndRename(child);
            }
        }
    }
}

// --- 5. Header Giải mã (Lua) ---
const LUA_DECRYPTOR_HEADER = `
--[[ OBFUSCATED BY RENDER API ]]
local function _D(e_b64, k)
    local success, e = pcall(string.fromBase64, e_b64)
    if not success or not e then return "ERR" end
    local r = {}
    local kl = #k
    for i = 1, #e do
        local enc_byte = string.byte(e, i)
        local key_byte = string.byte(k, (i - 1) % kl + 1)
        local res_byte = bit32 and bit32.bxor(enc_byte, key_byte) or (enc_byte ~ key_byte)
        table.insert(r, string.char(res_byte))
    end
    return table.concat(r)
end
`;

// --- 6. API Endpoint ---
app.post('/obfuscate', (req, res) => {
    const luaCode = req.body.lua_code;
    if (!luaCode || typeof luaCode !== 'string') {
        return res.status(400).json({ error: "Thiếu code Lua hợp lệ." });
    }

    if (!luaparse) return res.status(500).json({ error: "Lỗi Server: Thiếu thư viện luaparse." });

    // Reset
    identifierMap.clear();
    const ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    
    try {
        // BƯỚC A: Thu thập chuỗi cần mã hóa
        const stringsToEncrypt = [];
        luaparse.parse(luaCode, { 
            comments: false, locations: true,
            onCreateNode: function(node) {
                if (node.type === 'StringLiteral' && node.loc) {
                    stringsToEncrypt.push({
                        value: node.value,
                        start: node.loc.start.offset,
                        end: node.loc.end.offset
                    });
                }
            }
        });

        // BƯỚC B: Mã hóa chuỗi và thay thế vào code gốc
        stringsToEncrypt.sort((a, b) => b.start - a.start);
        let obfuscatedWithStrings = luaCode;

        stringsToEncrypt.forEach(str => {
            if (!str.value) return; 
            const encryptedB64 = xorEncrypt(str.value, ENCRYPTION_KEY);
            const callExpression = `_D("${encryptedB64}", "${ENCRYPTION_KEY}")`; 
            
            const before = obfuscatedWithStrings.substring(0, str.start);
            const after = obfuscatedWithStrings.substring(str.end);
            obfuscatedWithStrings = before + callExpression + after;
        });

        // BƯỚC C: Đổi tên biến
        const astForRenaming = luaparse.parse(obfuscatedWithStrings, { comments: false, locations: false });
        traverseAndRename(astForRenaming);

        // Thay thế tên biến bằng Regex (đơn giản hóa)
        let finalCode = obfuscatedWithStrings;
        identifierMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            finalCode = finalCode.replace(regex, newName);
        });

        res.json({
            success: true,
            obfuscated_code: LUA_DECRYPTOR_HEADER + "\n" + finalCode
        });

    } catch (error) {
        console.error("Lỗi xử lý:", error.message);
        res.status(400).json({ error: "Code Lua lỗi cú pháp.", details: error.message });
    }
});

app.get('/', (req, res) => res.send('Lua Obfuscator API is Running!'));

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
