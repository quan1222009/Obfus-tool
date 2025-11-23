// Script Node.js: Obfuscator API Nâng Cao (Giống Luraph)
const express = require('express');

const luaparse = () => {
    if (typeof require !== 'undefined') {
        return require('luaparse');
    }
    return null;
};

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json()); 

const luaparseLib = luaparse();
if (!luaparseLib) {
    console.error("Lỗi: Không tìm thấy thư viện luaparse.");
}

// Map để ánh xạ tên biến cũ sang tên biến mới
const identifierMap = new Map();

// Các chuỗi Lua/Roblox toàn cục KHÔNG ĐƯỢC ĐỔI TÊN
const LUA_GLOBALS = new Set([
    'print', 'wait', 'game', 'script', 'workspace', 'math', 'string', 'table', 
    'require', 'local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do',
    'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'pairs', 'ipairs', 'next', 'tostring', 'tonumber'
]);

// =========================================================================
//                             HÀM MÃ HÓA
// =========================================================================

const xorEncrypt = (text, key) => {
    if (!text) return "";
    
    const keyBytes = new TextEncoder().encode(key);
    const textBytes = new TextEncoder().encode(text);
    const encryptedBytes = new Uint8Array(textBytes.length);

    for (let i = 0; i < textBytes.length; i++) {
        encryptedBytes[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return Buffer.from(encryptedBytes).toString('base64');
};

const generateRandomIdentifier = () => {
    return '_' + Math.random().toString(36).substring(2, 9);
};

// =========================================================================
//                         LOGIC DUYỆT AST
// =========================================================================

let ENCRYPTION_KEY = ""; 

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

// =========================================================================
//                          DECRYPTOR HEADER LUA
// =========================================================================

const LUA_DECRYPTOR_HEADER = `
--[[ DECRYPTOR HEADER ]]
local function _D(e_b64, k)
    local success, e = pcall(string.fromBase64, e_b64)
    if not success or not e then return "ERR" end
    local r = {}
    local kl = #k
    for i = 1, #e do
        local enc_byte = string.byte(e, i)
        local key_byte = string.byte(k, (i - 1) % kl + 1)
        -- Su dung toan tu bitwise XOR cua Luau
        local res_byte = bit32 and bit32.bxor(enc_byte, key_byte) or (enc_byte ~ key_byte)
        table.insert(r, string.char(res_byte))
    end
    return table.concat(r)
end
`;

// =========================================================================
//                          ENDPOINT OBFUSCATOR
// =========================================================================

app.post('/obfuscate', (req, res) => {
    const luaCode = req.body.lua_code;

    if (!luaCode || typeof luaCode !== 'string') {
        return res.status(400).json({ error: "Thiếu code Lua hợp lệ." });
    }

    identifierMap.clear();
    ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    let finalCode = luaCode; 

    try {
        // 1. Thu thập String Literals bằng onCreateNode (Cách đúng của luaparse)
        const stringsToEncrypt = [];
        
        // Phân tích lần 1: Chỉ để lấy vị trí chuỗi
        luaparseLib.parse(luaCode, { 
            comments: false, 
            locations: true,
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

        // 2. Mã hóa chuỗi (Thay thế từ dưới lên để giữ đúng vị trí)
        let obfuscatedWithStrings = luaCode;
        
        // Sắp xếp ngược để thay thế từ cuối file lên đầu
        stringsToEncrypt.sort((a, b) => b.start - a.start);

        stringsToEncrypt.forEach(str => {
            // Bỏ qua nếu chuỗi rỗng
            if (!str.value) return; 

            const encryptedB64 = xorEncrypt(str.value, ENCRYPTION_KEY);
            const callExpression = `_D("${encryptedB64}", "${ENCRYPTION_KEY}")`; 
            
            const before = obfuscatedWithStrings.substring(0, str.start);
            const after = obfuscatedWithStrings.substring(str.end);
            
            obfuscatedWithStrings = before + callExpression + after;
        });

        // 3. Đổi tên biến (Renaming)
        // Phân tích lại code đã mã hóa chuỗi để lấy AST mới cho việc đổi tên
        const astForRenaming = luaparseLib.parse(obfuscatedWithStrings, {
            comments: false,
            locations: false
        });
        
        traverseAndRename(astForRenaming);

        // Áp dụng đổi tên bằng String Replacement
        finalCode = obfuscatedWithStrings;
        identifierMap.forEach((newName, oldName) => {
            // Regex để thay thế toàn bộ từ (tránh thay thế chuỗi con)
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            finalCode = finalCode.replace(regex, newName);
        });

        // 4. Ghép Header
        const result = LUA_DECRYPTOR_HEADER + "\n" + finalCode;

        res.json({
            success: true,
            obfuscated_code: result
        });

    } catch (error) {
        console.error("Lỗi Obfuscation:", error.message);
        res.status(400).json({ 
            error: "Lỗi xử lý code. Vui lòng kiểm tra cú pháp Lua.",
            details: error.message 
        });
    }
});

app.get('/', (req, res) => res.send('Lua Obfuscator API Ready. POST to /obfuscate'));

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
