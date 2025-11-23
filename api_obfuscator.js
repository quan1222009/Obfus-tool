// Script Node.js: Obfuscator API Nâng Cao (Giống Luraph)
const express = require('express');

// Chức năng require được sử dụng để tải thư viện luaparse
const luaparse = () => {
    // Sử dụng require để tránh lỗi với môi trường Node
    if (typeof require !== 'undefined') {
        return require('luaparse');
    }
    return null; // Fallback nếu không phải Node
};

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json()); // Middleware xử lý JSON body

const luaparseLib = luaparse();
if (!luaparseLib) {
    console.error("Lỗi: Không tìm thấy thư viện luaparse. Vui lòng chạy 'npm install luaparse'");
}

// Map để ánh xạ tên biến cũ sang tên biến mới (cho đổi tên)
const identifierMap = new Map();

// Các chuỗi Lua/Roblox toàn cục KHÔNG ĐƯỢC ĐỔI TÊN
const LUA_GLOBALS = new Set([
    'print', 'wait', 'game', 'script', 'workspace', 'math', 'string', 'table', 
    'require', 'local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do',
    'and', 'or', 'not', 'return', 'true', 'false', 'nil'
]);

// =========================================================================
//                             HÀM MÃ HÓA (NODE.JS)
// =========================================================================

/**
 * Mã hóa XOR một chuỗi văn bản và trả về chuỗi Base64
 * Sử dụng Buffer của Node.js cho Base64.
 * @param {string} text Chuỗi cần mã hóa.
 * @param {string} key Khóa XOR.
 * @returns {string} Chuỗi đã mã hóa (Base64).
 */
const xorEncrypt = (text, key) => {
    if (text === null || text === undefined || text === "") return "";
    
    // Sử dụng TextEncoder để xử lý các ký tự UTF-8
    const keyBytes = new TextEncoder().encode(key);
    const textBytes = new TextEncoder().encode(text);
    const encryptedBytes = new Uint8Array(textBytes.length);

    // XOR từng byte
    for (let i = 0; i < textBytes.length; i++) {
        encryptedBytes[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Sử dụng Buffer của Node.js để mã hóa Base64 an toàn
    const base64Encoded = Buffer.from(encryptedBytes).toString('base64');
    return base64Encoded;
};

/**
 * Tạo một chuỗi định danh ngẫu nhiên, khó đọc.
 */
const generateRandomIdentifier = () => {
    return '_' + Math.random().toString(36).substring(2, 8);
};

// =========================================================================
//                         LOGIC DUYỆT AST & BIẾN ĐỔI
// =========================================================================

// Khóa XOR ngẫu nhiên cho phiên mã hóa này
let ENCRYPTION_KEY = ""; 

/**
 * Duyệt AST để đổi tên biến.
 * @param {object} node Nút AST hiện tại
 */
function traverseAndTransform(node) {
    if (!node || typeof node !== 'object') {
        return;
    }

    // --- 1. ĐỔI TÊN ĐỊNH DANH (Identifier Renaming) ---
    if (node.type === 'Identifier') {
        const oldName = node.name;
        
        if (LUA_GLOBALS.has(oldName)) {
            return;
        }

        if (!identifierMap.has(oldName)) {
            identifierMap.set(oldName, generateRandomIdentifier());
        }

        node.name = identifierMap.get(oldName);
        return;
    }
    
    // Duyệt đệ quy
    for (const key in node) {
        if (node.hasOwnProperty(key)) {
            const child = node[key];
            if (Array.isArray(child)) {
                child.forEach(traverseAndTransform);
            } else {
                traverseAndTransform(child);
            }
        }
    }
}

// =========================================================================
//                          DECRYPTOR HEADER LUA (FIXED)
// =========================================================================

/**
 * Hàm giải mã XOR và Base64 bằng Luau/Roblox
 */
const LUA_DECRYPTOR_HEADER = `
--[[ 
    DECRYPTOR HEADER - Lõi Giải Mã Chuỗi
    Sử dụng toán tử XOR (~) của Luau, tương thích với môi trường Roblox hiện tại.
]]
local function _D(e_b64, k) -- _D là hàm Giải Mã (Decrypt)
    -- Lấy dữ liệu nhị phân đã mã hóa
    local success, e = pcall(string.fromBase64, e_b64)
    if not success or not e then return "DECODE_ERROR" end
    
    local r = {}
    local kl = #k
    
    -- Thực hiện XOR từng byte
    for i = 1, #e do
        local enc_byte = e:byte(i)
        -- Lấy byte khóa lặp lại (Wrap-around key byte)
        local key_byte = k:byte((i - 1) % kl + 1)
        
        -- Sử dụng toán tử XOR của Luau (~)
        r[i] = string.char(enc_byte ~ key_byte) 
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
        return res.status(400).json({ error: "Thiếu trường 'lua_code' hợp lệ trong yêu cầu." });
    }

    // 1. Khởi tạo
    identifierMap.clear();
    ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    let finalCode = luaCode; 

    try {
        // --- 1. PHÂN TÍCH VÀ BIẾN ĐỔI (AST) ---
        const ast = luaparseLib.parse(luaCode, { 
             comments: false, 
             locations: true 
        });

        // Áp dụng biến đổi (Đổi tên)
        traverseAndTransform(ast); 
        
        // --- 2. TÁI TẠO CODE MỚI ---
        
        // 2a. Mã hóa Chuỗi
        let obfuscatedWithStrings = luaCode; 
        
        const stringsToEncrypt = [];
        luaparseLib.parse(luaCode, { comments: false, locations: true }, function (node) {
            if (node.type === 'StringLiteral' && node.loc) {
                stringsToEncrypt.push({
                    value: node.value,
                    start: node.loc.start.offset,
                    end: node.loc.end.offset
                });
            }
        });
        
        let parts = [];
        let lastEnd = 0;

        // Xử lý các chuỗi từ cuối lên để tránh thay đổi vị trí
        stringsToEncrypt.sort((a, b) => b.start - a.start).forEach(str => {
            const encryptedB64 = xorEncrypt(str.value, ENCRYPTION_KEY);
            // Thay thế chuỗi gốc bằng lệnh gọi hàm giải mã _D
            const callExpression = `_D("${encryptedB64}", "${ENCRYPTION_KEY}")`; 
            
            parts.unshift(obfuscatedWithStrings.substring(str.end));
            parts.unshift(callExpression);
            obfuscatedWithStrings = obfuscatedWithStrings.substring(0, str.start);
            lastEnd = str.start;
        });
        
        parts.unshift(obfuscatedWithStrings.substring(0, lastEnd));
        finalCode = parts.join('');


        // 2b. Áp dụng Đổi tên Biến
        identifierMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            finalCode = finalCode.replace(regex, newName);
        });

        // --- 3. LẮP RÁP CODE CUỐI CÙNG ---
        const finalObfuscatedCode = LUA_DECRYPTOR_HEADER + "\n" + finalCode;

        res.json({
            success: true,
            obfuscator_type: "Luraph-Style: String Encryption (Cleaned) + Renaming",
            original_length: luaCode.length,
            obfuscated_code: finalObfuscatedCode,
            encryption_key: ENCRYPTION_KEY,
            identifiers_map: Object.fromEntries(identifierMap)
        });

    } catch (error) {
        console.error("Lỗi Obfuscation:", error.message);
        res.status(400).json({ 
            error: "Lỗi cú pháp Code Lua. Vui lòng kiểm tra lại code đầu vào.",
            details: error.message 
        });
    }
});

// Route kiểm tra sức khỏe (Health Check)
app.get('/', (req, res) => {
    res.send(`
        <h1>Lua Obfuscator API (Luraph-Style) đã sẵn sàng trên Render</h1>
        <p>API này thực hiện Đổi tên Biến và Mã hóa Chuỗi XOR/Base64.</p>
        <p>Để sử dụng, gửi yêu cầu POST đến <code>/obfuscate</code> với JSON body:</p>
        <pre>{ "lua_code": "local message = \\"Hello World\\"" }</pre>
    `);
});

// Khởi chạy Server
app.listen(PORT, () => {
    console.log(`✅ Obfuscator API Server đang chạy tại cổng ${PORT}`);
});
