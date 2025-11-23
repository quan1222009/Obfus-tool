// Script Node.js: Obfuscator API Nâng Cao (Giống Luraph)
const express = require('express');
const luaparse = require => {
    // Sử dụng require để tránh lỗi với môi trường Node
    if (typeof require !== 'undefined') {
        return require('luaparse');
    }
    return null; // Fallback nếu không phải Node
};

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json()); 

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
    
    // Chuyển đổi mảng byte sang chuỗi nhị phân (dùng cho btoa)
    const binaryString = String.fromCharCode.apply(null, encryptedBytes);
    // Mã hóa Base64
    return btoa(binaryString);
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
 * Duyệt AST để đổi tên biến và Mã hóa chuỗi.
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
    
    // --- 2. MÃ HÓA CHUỖI (String Encryption) ---
    if (node.type === 'StringLiteral') {
        const originalValue = node.value;
        
        // Mã hóa chuỗi bằng XOR và Base64
        const encryptedB64 = xorEncrypt(originalValue, ENCRYPTION_KEY);

        // Thay đổi loại nút thành CallExpression (gọi hàm giải mã)
        node.type = 'CallExpression';
        
        // Tạo nút Identifier cho hàm giải mã (_D)
        const decryptorIdentifier = {
            type: 'Identifier',
            name: '_D'
        };
        
        // Tạo nút StringLiteral cho chuỗi đã mã hóa
        const encryptedStringLiteral = {
            type: 'StringLiteral',
            value: encryptedB64,
            raw: `"${encryptedB64}"` // Để đảm bảo được tái tạo đúng
        };

        // Tạo nút StringLiteral cho khóa mã hóa
        const keyStringLiteral = {
            type: 'StringLiteral',
            value: ENCRYPTION_KEY,
            raw: `"${ENCRYPTION_KEY}"`
        };

        // Gán lại các thuộc tính của CallExpression
        node.base = decryptorIdentifier; // Tên hàm: _D
        node.arguments = [encryptedStringLiteral, keyStringLiteral]; // Đối số: chuỗi và khóa
        
        // Xóa các thuộc tính cũ của StringLiteral
        delete node.value;
        delete node.raw;
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
//                          HÀM TÁI TẠO CODE LUA (Mô phỏng)
// =========================================================================

/**
 * Hàm mô phỏng tái tạo code Lua từ AST đã biến đổi
 * Vì luaparse không có sẵn Code Generator, chúng ta sử dụng một thư viện đơn giản.
 * LƯU Ý: Đây là phần phức tạp nhất, chúng ta phải tự xây dựng bộ chuyển đổi AST -> Code
 * (Đã đơn giản hóa rất nhiều so với Luraph thực tế)
 */
const generateLuaCode = (ast) => {
    // Hàm này phải được triển khai đầy đủ để chuyển đổi mọi loại nút AST thành chuỗi Lua.
    // Vì giới hạn phức tạp, chúng ta sẽ chỉ tạo ra một bản tái tạo đơn giản
    // của các cấu trúc đã thay đổi (StringLiteral -> CallExpression) và dựa vào
    // string replacement cho các phần còn lại.
    
    // Thay vì triển khai đầy đủ Code Generator, chúng ta sẽ thực hiện
    // String Replacement dựa trên Map (Identifier Renaming)
    let luaCode = ast.lua_code_input;

    // 1. Đổi tên các định danh (Identifiers)
    identifierMap.forEach((newName, oldName) => {
        const regex = new RegExp('\\b' + oldName + '\\b', 'g');
        luaCode = luaCode.replace(regex, newName);
    });

    // 2. Mã hóa Chuỗi (Dựa trên Map đã tạo)
    // LƯU Ý QUAN TRỌNG: Do thiếu một Code Generator chuẩn, chúng ta phải xử lý
    // việc thay thế chuỗi mã hóa thủ công. Để giữ cho ví dụ này có thể triển khai,
    // chúng ta sẽ phải thực hiện một quá trình thay thế chuỗi nhiều bước hơn.
    
    // Chúng ta phải tìm lại các chuỗi gốc và thay thế chúng bằng _D("...", "...")
    // Do sự phức tạp của việc tái tạo AST trong một file đơn, chúng ta sẽ
    // dựa vào logic xử lý chuỗi đơn giản hơn cho phần mã hóa này (như file đầu tiên)
    // VÀ chỉ dựa vào AST cho phần Renaming.
    
    // Để giữ tinh thần Obfuscation và đảm bảo code chạy được:
    // CHỈ ĐỔI TÊN VÀ SỬ DỤNG LỆNH GỌI DECRYPTOR ĐƠN GIẢN.
    
    return luaCode; // Trả về code đã đổi tên.
};


// =========================================================================
//                          DECRYPTOR HEADER LUA
// =========================================================================

/**
 * Hàm giải mã XOR và Base64 bằng Luau/Roblox
 */
const LUA_DECRYPTOR_HEADER = `
--[[ 
    DECRYPTOR HEADER - Lõi Giải Mã Chuỗi (Giống Luraph)
    Sử dụng string.fromBase64 và bitwise XOR (~) của Luau.
]]
local function _D(e_b64, k) -- _D là hàm Giải Mã (Decrypt)
    -- Lấy dữ liệu nhị phân đã mã hóa
    local success, e = pcall(string.fromBase64, e_b64)
    if not success then return "DECODE_ERROR" end
    
    local r = {}
    local kl = #k
    
    -- Thực hiện XOR từng byte
    for i = 1, #e do
        local enc_byte = e:byte(i)
        -- Lấy byte khóa lặp lại (Wrap-around key byte)
        local key_byte = k:byte((i - 1) % kl + 1)
        -- XOR (~) và thêm vào mảng kết quả
        r[i] = string.char(bit32.bxor(enc_byte, key_byte)) -- Luau bit32.bxor
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
    // Tạo Khóa ngẫu nhiên (dài 8 ký tự)
    ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    let finalCode = luaCode; 

    try {
        // --- 1. PHÂN TÍCH VÀ BIẾN ĐỔI (AST) ---
        // Sử dụng luaparse để tạo AST và duyệt qua nó
        const ast = luaparseLib.parse(luaCode, { 
             comments: false, 
             locations: false 
        });

        // Áp dụng biến đổi (Đổi tên và Mã hóa chuỗi)
        traverseAndTransform(ast);
        
        // --- 2. TÁI TẠO CODE MỚI ---
        
        // Thực hiện đổi tên các định danh đã thu thập được từ AST
        identifierMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            finalCode = finalCode.replace(regex, newName);
        });
        
        // Bây giờ, áp dụng Mã hóa Chuỗi (đã thay thế các StringLiteral trong AST)
        // LƯU Ý: Đây là điểm yếu do thiếu Code Generator. Chúng ta sẽ thay thế 
        // string literals trong code gốc bằng CallExpression đã tạo trong AST.
        
        // QUAN TRỌNG: Mã hóa chuỗi bằng cách duyệt qua AST và thay thế trực tiếp 
        // là cách duy nhất để thực hiện Mã hóa Chuỗi mà không cần Code Generator phức tạp.
        
        let obfuscatedWithStrings = luaCode; // Bắt đầu lại với code gốc
        
        // Phân tích code gốc lần nữa để tìm các StringLiteral
        const stringsToEncrypt = [];
        luaparseLib.parse(luaCode, { comments: false, locations: true }, function (node) {
            if (node.type === 'StringLiteral' && node.loc) {
                // Thu thập giá trị gốc và vị trí của nó
                stringsToEncrypt.push({
                    value: node.value,
                    start: node.loc.start.offset,
                    end: node.loc.end.offset
                });
            }
        });
        
        // Tạo các mảng phần tử (để tái tạo code)
        let parts = [];
        let lastEnd = 0;

        // Xử lý các chuỗi từ cuối lên để tránh thay đổi vị trí
        stringsToEncrypt.sort((a, b) => b.start - a.start).forEach(str => {
            const encryptedB64 = xorEncrypt(str.value, ENCRYPTION_KEY);
            const callExpression = `_D("${encryptedB64}", "${ENCRYPTION_KEY}")`;
            
            // Lấy phần code sau chuỗi
            parts.unshift(obfuscatedWithStrings.substring(str.end));
            // Chèn biểu thức gọi hàm giải mã
            parts.unshift(callExpression);
            // Cắt phần code trước chuỗi
            obfuscatedWithStrings = obfuscatedWithStrings.substring(0, str.start);
            lastEnd = str.start;
        });
        
        // Thêm phần đầu tiên của code
        parts.unshift(obfuscatedWithStrings.substring(0, lastEnd));
        
        // Nối lại các phần
        finalCode = parts.join('');

        // 4. Áp dụng Đổi tên Biến Lần cuối (trên code đã mã hóa chuỗi)
        identifierMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            finalCode = finalCode.replace(regex, newName);
        });

        // --- 5. LẮP RÁP CODE CUỐI CÙNG ---
        const finalObfuscatedCode = LUA_DECRYPTOR_HEADER + "\n" + finalCode;

        res.json({
            success: true,
            obfuscator_type: "Luraph-Style: String Encryption + Renaming",
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
