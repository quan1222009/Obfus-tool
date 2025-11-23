// Script Node.js: Obfuscator API Nâng Cao (Giống Luraph)
const express = require('express');

// Hàm require an toàn cho luaparse
const luaparse = () => {
    try {
        return require('luaparse');
    } catch (e) {
        return null;
    }
};

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json()); 

const luaparseLib = luaparse();
if (!luaparseLib) {
    console.error("Lỗi: Không tìm thấy thư viện luaparse. Vui lòng chạy 'npm install luaparse'");
}

// Map để ánh xạ tên biến cũ sang tên biến mới
const identifierMap = new Map();

// Các từ khóa Lua/Roblox KHÔNG ĐƯỢC ĐỔI TÊN
const LUA_GLOBALS = new Set([
    'print', 'wait', 'game', 'script', 'workspace', 'math', 'string', 'table', 
    'require', 'local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do',
    'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'pairs', 'ipairs', 'next', 
    'tostring', 'tonumber', 'pcall', 'xpcall', 'select', 'unpack'
]);

// =========================================================================
//                             HÀM MÃ HÓA (NODE.JS)
// =========================================================================

// Hàm mã hóa XOR và chuyển sang Base64 (Dùng Buffer chuẩn Node.js)
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

const generateRandomIdentifier = () => {
    return '_' + Math.random().toString(36).substring(2, 9);
};

// =========================================================================
//                         LOGIC DUYỆT AST (ĐỔI TÊN)
// =========================================================================

let ENCRYPTION_KEY = ""; 

function traverseAndRename(node) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'Identifier') {
        const oldName = node.name;
        // Chỉ đổi tên nếu không phải từ khóa toàn cục
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
        -- Ho tro ca Luau (~) va Lua 5.1 (bit32)
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

    // Reset trạng thái
    identifierMap.clear();
    ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    let finalCode = luaCode; 

    try {
        // BƯỚC 1: Thu thập tất cả chuỗi (String Literals)
        const stringsToEncrypt = [];
        
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

        // BƯỚC 2: Mã hóa chuỗi và thay thế vào code gốc
        // Sắp xếp ngược (từ cuối file lên đầu) để thay thế không làm lệch vị trí các chuỗi trước đó
        stringsToEncrypt.sort((a, b) => b.start - a.start);

        let obfuscatedWithStrings = luaCode;

        stringsToEncrypt.forEach(str => {
            // Bỏ qua chuỗi rỗng hoặc quá ngắn
            if (!str.value || str.value.length === 0) return; 

            const encryptedB64 = xorEncrypt(str.value, ENCRYPTION_KEY);
            const callExpression = `_D("${encryptedB64}", "${ENCRYPTION_KEY}")`; 
            
            // Cắt và ghép chuỗi an toàn
            const before = obfuscatedWithStrings.substring(0, str.start);
            const after = obfuscatedWithStrings.substring(str.end);
            
            obfuscatedWithStrings = before + callExpression + after;
        });

        // BƯỚC 3: Đổi tên biến (Renaming)
        // Phân tích lại đoạn code đã mã hóa chuỗi để lấy cấu trúc biến
        const astForRenaming = luaparseLib.parse(obfuscatedWithStrings, {
            comments: false,
            locations: false
        });
        
        traverseAndRename(astForRenaming);

        // Áp dụng đổi tên bằng String Replacement (Regex)
        finalCode = obfuscatedWithStrings;
        identifierMap.forEach((newName, oldName) => {
            // Chỉ thay thế "từ trọn vẹn" (whole word)
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            finalCode = finalCode.replace(regex, newName);
        });

        // BƯỚC 4: Ghép Header giải mã
        const result = LUA_DECRYPTOR_HEADER + "\n" + finalCode;

        res.json({
            success: true,
            obfuscated_code: result
        });

    } catch (error) {
        console.error("Lỗi Obfuscation:", error.message);
        res.status(400).json({ 
            error: "Lỗi xử lý code. Vui lòng kiểm tra cú pháp Lua đầu vào.",
            details: error.message 
        });
    }
});

app.get('/', (req, res) => res.send('Lua Obfuscator API Ready. POST to /obfuscate'));

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
