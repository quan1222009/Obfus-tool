// Script Node.js: Obfuscator API - Maximum Security (Self-Encoded Decryptor)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json()); 

// --- 1. Cấu hình Luaparse an toàn ---
let luaparse;
try {
    luaparse = require('luaparse');
} catch (e) {
    console.error("CẢNH BÁO: Chưa cài luaparse. Vui lòng chạy: npm install luaparse");
}

// --- 2. Logic Mã Hóa (Server Side) ---

// ĐỊNH NGHĨA HÀM TRƯỚC KHI SỬ DỤNG
const generateRandomIdentifier = () => '_' + Math.random().toString(36).substring(2, 9);

const identifierMap = new Map();
const LUA_KEYWORDS = [
    'local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do',
    'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'repeat', 'until', 'break',
];
const LUA_GLOBALS_MAP = {
    'print': { table: 1, key: 1 },
    'game': { table: 1, key: 2 },
    'Instance': { table: 1, key: 3 },
    'wait': { table: 1, key: 4 },
    'math': { table: 1, key: 5 },
    'string': { table: 1, key: 6 },
    'tostring': { table: 1, key: 7 },
    'ipairs': { table: 1, key: 8 },
    'pcall': { table: 1, key: 9 },
    'loadstring': { table: 1, key: 10 }, // Cần cho Self-Encoded Decryptor
    'Players': { table: 2, key: 1 },
    'LocalPlayer': { table: 2, key: 2 },
    'Character': { table: 2, key: 3 },
    'Humanoid': { table: 2, key: 4 },
    'CharacterAdded': { table: 2, key: 5 },
    'TakeDamage': { table: 2, key: 6 },
    'Name': { table: 2, key: 7 },
    'Workspace': { table: 2, key: 8 },
    'fromBase64': { table: 3, key: 1 }, // string.fromBase64
};

// Biến cho cấu trúc tự mã hóa/phẳng hóa luồng điều khiển
const DECRYPTOR_FUNC_NAME = generateRandomIdentifier(); // Tên hàm giải mã (ví dụ: _D5xYd2z)
const GLOBAL_TABLE_VAR = generateRandomIdentifier(); // Tên bảng Globals (ví dụ: _G9aC3fR)
const KEYWORD_FUNC_VAR = generateRandomIdentifier(); // Tên hàm Keyword Mapper (ví dụ: _KW7eH4o)
const KEYWORD_MAP_VAR = generateRandomIdentifier(); // Tên bảng Keyword (ví dụ: _KM2gI1k)


const xorEncrypt = (text, key) => {
    if (!text) return "";
    // Sửa lỗi: Đảm bảo keyBytes được tạo từ tham số 'key'
    const keyBytes = Buffer.from(key, 'utf-8'); 
    const textBytes = Buffer.from(text, 'utf-8');
    const encryptedBytes = Buffer.alloc(textBytes.length);
    for (let i = 0; i < textBytes.length; i++) {
        encryptedBytes[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return encryptedBytes.toString('base64');
};

const obfuscateNumber = (num) => {
    if (typeof num !== 'number' || Math.abs(num) < 1) return num;
    const key1 = Math.floor(Math.random() * 10) + 2; 
    const key2 = num - key1;
    return `(${key1} + ${key2})`;
};

function traverseAndRename(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Identifier') {
        const oldName = node.name;
        if (!LUA_KEYWORDS.includes(oldName) && !LUA_GLOBALS_MAP.hasOwnProperty(oldName)) {
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
            if (Array.isArray(child)) child.forEach(traverseAndRename);
            else traverseAndRename(child);
        }
    }
}

function advancedReplace(code, encryptionKey) {
    // 1. Thay thế các biến Toàn cục (Global) bằng _G[t][k]
    let codeAfterGlobalReplacement = code;
    Object.keys(LUA_GLOBALS_MAP).forEach(globalName => {
        const { table, key } = LUA_GLOBALS_MAP[globalName];
        const regex = new RegExp(`\\b${globalName}\\b`, 'g');
        
        // Xử lý đặc biệt cho string.fromBase64
        if (globalName === 'fromBase64') return; 
        
        codeAfterGlobalReplacement = codeAfterGlobalReplacement.replace(regex, `${GLOBAL_TABLE_VAR}[${table}][${key}]`);
    });

    // 2. Thay thế các Từ khóa Lua (Keyword) bằng _KW('keyword')
    let finalCode = codeAfterGlobalReplacement;
    LUA_KEYWORDS.forEach(keyword => {
        // Chỉ thay thế các từ khóa quan trọng
        if (['local', 'function', 'if', 'then', 'else', 'for', 'in', 'while', 'do', 'return', 'repeat', 'until', 'break'].includes(keyword)) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const replacement = `${KEYWORD_FUNC_VAR}('${keyword}')`; 
            finalCode = finalCode.replace(regex, replacement);
        }
    });

    return finalCode;
}

// Làm phẳng luồng điều khiển nâng cấp
function controlFlowFlatten(code) {
    const stateVar = generateRandomIdentifier();
    const dispatcher = generateRandomIdentifier();
    const funcName = generateRandomIdentifier();
    // Đã xóa deadCodeBlock1 và deadCodeBlock2 vì chúng không được sử dụng

    const flattenedCode = `
${KEYWORD_FUNC_VAR}('local') ${stateVar} = 1
${KEYWORD_FUNC_VAR}('local') ${dispatcher} = {
    [1] = ${KEYWORD_FUNC_VAR}('function') () 
${code}
        ${stateVar} = 0
    ${KEYWORD_FUNC_VAR}('end') ,
    -- Khối dead code để làm rối (chạy loadstring('return nil'))
    [2] = ${KEYWORD_FUNC_VAR}('function') () ${GLOBAL_TABLE_VAR}[1][10](${KEYWORD_FUNC_VAR}('return') ${KEYWORD_FUNC_VAR}('nil'))() ${KEYWORD_FUNC_VAR}('end'),
    [3] = ${KEYWORD_FUNC_VAR}('function') () ${GLOBAL_TABLE_VAR}[1][10](${KEYWORD_FUNC_VAR}('return') ${KEYWORD_FUNC_VAR}('nil'))() ${KEYWORD_FUNC_VAR}('end'),
}
${KEYWORD_FUNC_VAR}('local') ${funcName} = ${dispatcher}[${stateVar}]
${KEYWORD_FUNC_VAR}('while') ${stateVar} ~= 0 ${KEYWORD_FUNC_VAR}('do')
    ${KEYWORD_FUNC_VAR}('local') success, err = ${GLOBAL_TABLE_VAR}[1][9](${funcName})
    ${KEYWORD_FUNC_VAR}('if') ${KEYWORD_FUNC_VAR}('not') success ${KEYWORD_FUNC_VAR}('then') ${stateVar} = 0 ${KEYWORD_FUNC_VAR}('end')
    ${funcName} = ${dispatcher}[${stateVar}]
    ${KEYWORD_FUNC_VAR}('if') ${KEYWORD_FUNC_VAR}('not') ${funcName} ${KEYWORD_FUNC_VAR}('then') ${KEYWORD_FUNC_VAR}('break') ${KEYWORD_FUNC_VAR}('end')
${KEYWORD_FUNC_VAR}('end')
`;
    return flattenedCode;
}

// Hàm giải mã XOR Lua gốc (được mã hóa và thực thi bằng loadstring)
const ORIGINAL_DECRYPTOR_LUA = (decryptorName, globalTable) => {
    // Lưu ý: Các từ khóa 'local', 'function', 'return', 'end' trong hàm này phải được giữ nguyên
    // để nó có thể được loadstring và trả về (trước khi hàm Keyword Mapper được setup).
    return `
local function ${decryptorName}(e_b64, k)
    local success, e = ${globalTable}[1][9](${globalTable}[3][1], ${globalTable}[1][6], e_b64)
    if not success or not e then return "" end
    local r = {}
    local kl = #k
    for i = 1, #e do
        local enc_byte = ${globalTable}[1][6].byte(e, i)
        local key_byte = ${globalTable}[1][6].byte(k, (i - 1) % kl + 1)
        local res_byte = bit32 and bit32.bxor(enc_byte, key_byte) or (enc_byte ~ key_byte)
        r[#r + 1] = ${globalTable}[1][6].char(res_byte)
    end
    return ${globalTable}[1][6].concat(r)
end
return ${decryptorName}
`;
}


// Header chứa các hàm giải mã chính và ánh xạ
const LUA_HEADER = (encryptionKey) => {
    
    // Khởi tạo bảng Globals (Chỉ chứa các hàm cơ bản để chạy loadstring)
    let globalTableCreation = `local ${GLOBAL_TABLE_VAR} = {}\n`;
    globalTableCreation += `${GLOBAL_TABLE_VAR}[1] = {}\n`;
    globalTableCreation += `${GLOBAL_TABLE_VAR}[3] = {}\n`;

    // Khởi tạo các global cần thiết cho quá trình tự giải mã
    Object.entries(LUA_GLOBALS_MAP).forEach(([globalName, { table, key }]) => {
        if (table === 1 && key <= 10) {
            // pcall, loadstring, string được gán trực tiếp
            globalTableCreation += `${GLOBAL_TABLE_VAR}[${table}][${key}] = ${globalName}\n`; 
        } else if (table === 3 && key === 1) { // string.fromBase64
            globalTableCreation += `${GLOBAL_TABLE_VAR}[${table}][${key}] = string.fromBase64\n`; 
        }
    });

    // 1. Mã hóa toàn bộ hàm giải mã ORIGINAL_DECRYPTOR_LUA
    const rawDecryptor = ORIGINAL_DECRYPTOR_LUA(DECRYPTOR_FUNC_NAME, GLOBAL_TABLE_VAR);
    const encryptedDecryptor = xorEncrypt(rawDecryptor, encryptionKey);

    // 2. Mã hóa các từ khóa
    let keywordMapCreation = `local ${KEYWORD_MAP_VAR} = {}\n`;
    LUA_KEYWORDS.forEach(kw => {
        const encryptedB64 = xorEncrypt(kw, encryptionKey);
        keywordMapCreation += `${KEYWORD_MAP_VAR}["${kw}"] = "${encryptedB64}"\n`; // Lưu trữ B64
    });

    // 3. Script khởi tạo (Self-Execution Block)
    const selfExecuteScript = `
--[[ Bước 1: Khởi tạo Globals cơ bản (pcall, loadstring, string) ]]
${globalTableCreation}

--[[ Bước 2: Giải mã và thực thi hàm giải mã chính (${DECRYPTOR_FUNC_NAME}) ]]
-- Tạo hàm tạm thời _X (chứa logic giải mã) để tự giải mã ORIGINAL_DECRYPTOR_LUA
local function _X(e_b64, k)
    -- Sử dụng các globals đã được map
    local success, e = ${GLOBAL_TABLE_VAR}[1][9](${GLOBAL_TABLE_VAR}[3][1], ${GLOBAL_TABLE_VAR}[1][6], e_b64)
    if not success or not e then return "" end
    local r = {}
    local kl = #k
    for i = 1, #e do
        local enc_byte = ${GLOBAL_TABLE_VAR}[1][6].byte(e, i)
        local key_byte = ${GLOBAL_TABLE_VAR}[1][6].byte(k, (i - 1) % kl + 1)
        local res_byte = bit32 and bit32.bxor(enc_byte, key_byte) or (enc_byte ~ key_byte)
        r[#r + 1] = ${GLOBAL_TABLE_VAR}[1][6].char(res_byte)
    end
    return ${GLOBAL_TABLE_VAR}[1][6].concat(r)
end
-- Giải mã ORIGINAL_DECRYPTOR_LUA và lưu kết quả vào DECRYPTOR_FUNC_NAME
local ${DECRYPTOR_FUNC_NAME} = _X("${encryptedDecryptor}", "${encryptionKey}")
-- Chạy loadstring(DECRYPTOR_FUNC_NAME) để định nghĩa DECRYPTOR_FUNC_NAME là hàm
${GLOBAL_TABLE_VAR}[1][9](${GLOBAL_TABLE_VAR}[1][10](${DECRYPTOR_FUNC_NAME}))

--[[ Bước 3: Hoàn thành bảng Globals bằng cách giải mã các chuỗi còn lại ]]
${GLOBAL_TABLE_VAR}[2] = {} -- Khởi tạo Table 2
${Object.entries(LUA_GLOBALS_MAP).map(([globalName, { table, key }]) => {
    if (table === 1 && key > 10) { // Các Globals không cơ bản ở Table 1
        return `${GLOBAL_TABLE_VAR}[${table}][${key}] = _X('${xorEncrypt(globalName, encryptionKey)}', '${encryptionKey}')`;
    } else if (table === 2) { // Các Globals ở Table 2
        return `${GLOBAL_TABLE_VAR}[${table}][${key}] = _X('${xorEncrypt(globalName, encryptionKey)}', '${encryptionKey}')`;
    }
    return '';
}).filter(Boolean).join('\n')}

--[[ Bước 4: Khởi tạo Keyword Mapper ]]
${keywordMapCreation}
local ${KEYWORD_FUNC_VAR} = function(key) 
    -- Sử dụng hàm _X (vẫn còn) để giải mã chuỗi từ khóa
    return _X(${KEYWORD_MAP_VAR}[key], "${encryptionKey}")
end

--[[ Bước 5: Xóa các biến tạm thời để "dọn dẹp" ]]
_X = nil
${KEYWORD_MAP_VAR} = nil
`;

    return `
--[[ OBFUSCATED BY RENDER API (MAXIMUM SECURITY) ]]
${selfExecuteScript}
`;
};

// --- 3. API Endpoint ---
app.post('/obfuscate', (req, res) => {
    const luaCode = req.body.lua_code;
    if (!luaCode || typeof luaCode !== 'string') return res.status(400).json({ error: "Thiếu code Lua." });
    if (!luaparse) return res.status(500).json({ error: "Lỗi Server: Thiếu thư viện luaparse." });

    identifierMap.clear();
    const ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    
    try {
        const tokensToReplace = []; 

        luaparse.parse(luaCode, { 
            comments: false, locations: true,
            onCreateNode: function(node) {
                if (node.type === 'StringLiteral' && node.loc) {
                    tokensToReplace.push({ type: 'string', value: node.value, start: node.loc.start.offset, end: node.loc.end.offset });
                } else if (node.type === 'NumericLiteral' && node.loc) {
                     tokensToReplace.push({ type: 'number', value: node.value, start: node.loc.start.offset, end: node.loc.end.offset });
                }
            }
        });

        tokensToReplace.sort((a, b) => b.start - a.start);
        let currentCode = luaCode;

        tokensToReplace.forEach(token => {
            if (token.type === 'string' && token.value) {
                const encryptedB64 = xorEncrypt(token.value, ENCRYPTION_KEY);
                // Dùng tên hàm giải mã ngẫu nhiên đã được tự thực thi
                const callExpression = `${DECRYPTOR_FUNC_NAME}('${encryptedB64}', '${ENCRYPTION_KEY}')`; 
                const before = currentCode.substring(0, token.start);
                const after = currentCode.substring(token.end);
                currentCode = before + callExpression + after;
            } else if (token.type === 'number') {
                const obfusNum = obfuscateNumber(token.value);
                const before = currentCode.substring(0, token.start);
                const after = currentCode.substring(token.end);
                currentCode = before + obfusNum + after;
            }
        });

        const codeAfterGlobalKeywordReplacement = advancedReplace(currentCode, ENCRYPTION_KEY);

        const astForRenaming = luaparse.parse(codeAfterGlobalKeywordReplacement, { comments: false, locations: false });
        traverseAndRename(astForRenaming);

        let codeAfterRenaming = codeAfterGlobalKeywordReplacement;
        identifierMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            codeAfterRenaming = codeAfterRenaming.replace(regex, newName);
        });

        const flattenedCode = controlFlowFlatten(codeAfterRenaming);

        res.json({
            success: true,
            obfuscated_code: LUA_HEADER(ENCRYPTION_KEY) + "\n" + flattenedCode,
            decryptor_name: DECRYPTOR_FUNC_NAME // Truyền tên hàm giải mã cho client
        });

    } catch (error) {
        res.status(400).json({ error: "Lỗi cú pháp Lua.", details: error.message });
    }
});

// --- 4. GIAO DIỆN WEB (FIXED DEOBFUSCATE INPUT & COPY) ---
app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Roblox Lua Obfuscator Pro</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            .copied { background-color: #22c55e !important; }
        </style>
    </head>
    <body class="bg-gray-900 text-gray-100 font-sans p-4 md:p-8">
        <div class="max-w-5xl mx-auto">
            <header class="text-center mb-10">
                <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-yellow-600 mb-2">Lua Obfuscator MAXIMUM SECURITY</h1>
                <p class="text-gray-400">Ẩn hàm giải mã, mã hóa toàn bộ từ khóa và globals. Xóa hết bằng chứng chứng cứ.</p>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <!-- CỘT TRÁI: INPUT & OUTPUT -->
                <div class="space-y-4">
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700">
                        <label class="block text-red-300 font-bold mb-2 flex justify-between">
                            <span>1. Code Lua Gốc</span>
                            <span class="text-xs text-gray-500 font-normal">Input</span>
                        </label>
                        <textarea id="inputCode" class="w-full h-40 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-green-400 focus:outline-none focus:border-red-500 transition">local welcomeMessage = "Chào mừng bạn!" local damageAmount = 50 local function applyDamage(target, amount) print("Mục tiêu bị trừ " .. tostring(amount) .. " máu.") end local player = game.Players.LocalPlayer print(welcomeMessage) applyDamage(player.Character.Humanoid, damageAmount)</textarea>
                    </div>
                    
                    <button onclick="doObfuscate()" id="btnObfus" class="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95">
                        💀 MÃ HÓA TỐI ĐA (MAX SECURITY)
                    </button>

                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700 relative">
                        <label class="block text-yellow-300 font-bold mb-2 flex justify-between">
                            <span>2. Kết Quả Mã Hóa</span>
                            <span class="text-xs text-gray-500 font-normal">Output</span>
                        </label>
                        <textarea id="outputCode" class="w-full h-52 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-yellow-400 focus:outline-none" readonly placeholder="Code đã mã hóa sẽ hiện ở đây..."></textarea>
                        
                        <!-- NÚT COPY -->
                        <button onclick="copyToClipboard('outputCode')" id="btnCopyOutput" class="absolute top-12 right-7 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1 px-3 rounded border border-gray-500 transition">
                            📋 COPY
                        </button>
                    </div>
                </div>

                <!-- CỘT PHẢI: CÔNG CỤ DEOBFUSCATOR -->
                <div class="space-y-4">
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700 border-t-4 border-t-blue-500 h-full">
                        <label class="block text-blue-400 font-bold mb-2">3. Công cụ Giải mã Chuỗi (Deobfuscator):</label>
                        <p class="text-xs text-gray-400 mb-3 font-bold text-yellow-300">⚠️ Code mới sử dụng tên hàm ngẫu nhiên. Vui lòng **COPY TOÀN BỘ** code đã mã hóa và **Nhập tên hàm** nếu biết (ví dụ: _D4f9jGz).</p>
                        
                        <!-- Tên hàm giải mã -->
                        <div class="mb-3">
                             <input type="text" id="decryptorNameInput" placeholder="Tên hàm giải mã (ví dụ: _D5xYd2z)" class="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm font-mono text-red-300 focus:outline-none focus:border-blue-500 transition" value="">
                             <p id="decryptorNameHint" class="text-xs text-green-400 mt-1"></p>
                        </div>

                        <!-- Ô NHẬP DEOBFUSCATE MỚI ĐỘC LẬP -->
                        <textarea id="deobfusInput" class="w-full h-48 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-gray-300 focus:outline-none focus:border-blue-500 transition" placeholder="Dán code đã mã hóa vào đây để kiểm tra..."></textarea>

                        <button onclick="doDeobfuscate()" id="btnDeobfus" class="mt-3 w-full bg-blue-900/50 hover:bg-blue-900/80 text-blue-200 font-bold py-2 px-4 rounded-xl border border-blue-800 transition mb-3 transform hover:scale-[1.01] active:scale-95">
                            🔓 GIẢI MÃ CHUỖI ẨN (Decode Strings)
                        </button>
                        
                        <div id="deobfusResult" class="p-3 bg-black/50 rounded border border-gray-700 text-gray-300 font-mono text-xs max-h-48 overflow-y-auto hidden"></div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let lastDecryptorName = '';

            // --- LOGIC COPY ---
            function copyToClipboard(elementId) {
                const element = document.getElementById(elementId);
                if (!element.value) return;
                
                element.select();
                element.setSelectionRange(0, 99999); 
                document.execCommand('copy'); 

                const btn = document.getElementById('btnCopyOutput');
                const originalText = '📋 COPY';
                btn.innerText = "✅ ĐÃ COPY";
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            }

            // --- LOGIC GỌI API ---
            async function doObfuscate() {
                const btn = document.getElementById('btnObfus');
                const input = document.getElementById('inputCode').value;
                const output = document.getElementById('outputCode');
                const decryptorHint = document.getElementById('decryptorNameHint');
                
                if(!input.trim()) {
                    // Use custom modal or message box instead of alert()
                    output.value = "LỖI: Vui lòng nhập code!";
                    return;
                }

                btn.innerText = "⏳ Đang xử lý...";
                btn.disabled = true;
                btn.classList.add('opacity-50');

                try {
                    const res = await fetch('/obfuscate', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ lua_code: input })
                    });
                    const data = await res.json();
                    
                    if(data.success) {
                        output.value = data.obfuscated_code;
                        // Cập nhật tên hàm giải mã cho client
                        lastDecryptorName = data.decryptor_name || '';
                        document.getElementById('decryptorNameInput').value = lastDecryptorName;
                        decryptorHint.innerText = \`Tên hàm giải mã hiện tại: \${lastDecryptorName}\`;
                        
                        // Tự động dán vào ô Deobfus để người dùng test ngay
                        document.getElementById('deobfusInput').value = data.obfuscated_code;
                        document.getElementById('deobfusResult').classList.add('hidden');
                    } else {
                        output.value = "LỖI: " + (data.error || data.details || "Không rõ");
                    }
                } catch(e) {
                    output.value = "Lỗi kết nối server: " + e.message;
                }
                btn.innerText = "💀 MÃ HÓA TỐI ĐA (MAX SECURITY)";
                btn.disabled = false;
                btn.classList.remove('opacity-50');
            }

            // --- LOGIC GIẢI MÃ CHUỖI TẠI TRÌNH DUYỆT (FIXED AND ROBUST) ---
            function doDeobfuscate() {
                const input = document.getElementById('deobfusInput').value;
                const resultDiv = document.getElementById('deobfusResult');
                const decryptorName = document.getElementById('decryptorNameInput').value.trim();
                
                if (!input.trim() || !decryptorName) {
                    resultDiv.classList.remove('hidden');
                    resultDiv.innerHTML = "<b class='text-red-400'>Vui lòng dán code VÀ nhập tên hàm giải mã.</b>";
                    return;
                }
                
                // Regex mạnh mẽ: sử dụng tên hàm ngẫu nhiên lấy từ input/lastDecryptorName
                // Bắt chính xác TênHàm('base64', 'key')
                const regex = new RegExp(decryptorName + '\\s*\\(\\s*([\'"])([^"\']+)\\1\\s*,\\s*([\'"])([^"\']+)\\3\\s*\\)', 'g');

                let match;
                let foundCount = 0;
                let decodedStrings = [];
                const keywordList = ['local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do', 'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'repeat', 'until', 'print', 'game', 'Instance', 'wait', 'math', 'string', 'tostring', 'ipairs', 'pcall', 'loadstring', 'Players', 'LocalPlayer', 'Character', 'Humanoid', 'CharacterAdded', 'TakeDamage', 'Name', 'Workspace'];


                while ((match = regex.exec(input)) !== null) {
                    foundCount++;
                    // match[2] là base64 data, match[4] là key
                    const b64 = match[2];
                    const key = match[4];
                    try {
                        const decodedStr = xorDecryptJS(b64, key);
                        
                        // Chỉ hiển thị các chuỗi không phải là từ khóa Lua (đã biết trước)
                        if (!keywordList.includes(decodedStr)) {
                             decodedStrings.push(\`[\${foundCount}] "\${decodedStr}"\`);
                        }
                       
                    } catch(e) {
                        decodedStrings.push(\`[\${foundCount}] <span class="text-red-400">(Lỗi giải mã chuỗi)</span>\`);
                    }
                }

                resultDiv.classList.remove('hidden');
                if(decodedStrings.length > 0) {
                    resultDiv.innerHTML = "<b class='text-green-400'>Tìm thấy " + decodedStrings.length + " chuỗi người dùng ẩn:</b><br>" + decodedStrings.join('<br>');
                } else if (foundCount > 0 && decodedStrings.length === 0) {
                     resultDiv.innerHTML = "<b class='text-yellow-400'>Tìm thấy " + foundCount + " lệnh \${decryptorName}(), nhưng tất cả đều là các từ khóa Lua/Global.</b>";
                } else {
                    resultDiv.innerHTML = "<b class='text-red-400'>Không tìm thấy mẫu mã hóa hợp lệ (\${decryptorName})</b>. Vui lòng kiểm tra tên hàm và đảm bảo bạn đã dán TOÀN BỘ code.";
                }
            }

            // Hàm giải mã JS tương đương với Lua
            function xorDecryptJS(b64, key) {
                const binaryString = atob(b64);
                let result = "";
                const kLen = key.length;
                
                for (let i = 0; i < binaryString.length; i++) {
                    const charCode = binaryString.charCodeAt(i);
                    const keyChar = key.charCodeAt(i % kLen);
                    result += String.fromCharCode(charCode ^ keyChar);
                }
                
                try {
                    // Cố gắng decode URI để xử lý ký tự UTF-8 nếu có (như tiếng Việt)
                    return decodeURIComponent(escape(result));
                } catch(e) {
                    return result; 
                }
            }
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
