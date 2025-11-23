// Script Node.js: Obfuscator API - Maximum Obfuscation (Keyword/Table Mapping)
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
const identifierMap = new Map();
const LUA_KEYWORDS = [
    'local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do',
    'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'repeat', 'until',
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
    'Players': { table: 2, key: 1 },
    'LocalPlayer': { table: 2, key: 2 },
    'Character': { table: 2, key: 3 },
    'Humanoid': { table: 2, key: 4 },
    'CharacterAdded': { table: 2, key: 5 },
    'TakeDamage': { table: 2, key: 6 },
    'Name': { table: 2, key: 7 },
    'Workspace': { table: 2, key: 8 },
};
// Biến cho các hàm/bảng chung
const GLOBAL_TABLE_VAR = generateRandomIdentifier(); 
const KEYWORD_FUNC_VAR = generateRandomIdentifier();
const KEYWORD_MAP_VAR = generateRandomIdentifier();
const DECRYPT_FUNC_VAR = '_D'; // Giữ nguyên cho Deobfus Client

const generateRandomIdentifier = () => '_' + Math.random().toString(36).substring(2, 9);

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
    let codeAfterGlobalReplacement = code;
    Object.keys(LUA_GLOBALS_MAP).forEach(globalName => {
        const { table, key } = LUA_GLOBALS_MAP[globalName];
        const regex = new RegExp(`\\b${globalName}\\b`, 'g');
        codeAfterGlobalReplacement = codeAfterGlobalReplacement.replace(regex, `${GLOBAL_TABLE_VAR}[${table}][${key}]`);
    });

    let finalCode = codeAfterGlobalReplacement;
    LUA_KEYWORDS.forEach(keyword => {
        // Chỉ thay thế các từ khóa quan trọng có thể bị bắt bởi decompiler/string searching
        if (['local', 'function', 'if', 'then', 'else', 'for', 'in', 'while', 'do', 'return', 'repeat', 'until'].includes(keyword)) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            // Thay thế bằng hàm gọi bản đồ từ khóa
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

    const flattenedCode = `
${KEYWORD_FUNC_VAR}('local') ${stateVar} = 1
${KEYWORD_FUNC_VAR}('local') ${dispatcher} = {
    [1] = ${KEYWORD_FUNC_VAR}('function') () 
${code}
        ${stateVar} = 0
    ${KEYWORD_FUNC_VAR}('end') ,
    [2] = ${KEYWORD_FUNC_VAR}('function') () end,
    [3] = ${KEYWORD_FUNC_VAR}('function') () end,
    [4] = ${KEYWORD_FUNC_VAR}('function') () end,
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


// Header chứa các hàm giải mã chính và ánh xạ
const LUA_HEADER = (encryptionKey) => {
    
    // Tạo bảng ánh xạ các giá trị toàn cục
    let globalTableCreation = `${KEYWORD_FUNC_VAR}('local') ${GLOBAL_TABLE_VAR} = {}\n`;
    Object.entries(LUA_GLOBALS_MAP).forEach(([globalName, { table, key }]) => {
        if (table === 1 && key === 1) { // Chỉ khởi tạo table 1 lần
             globalTableCreation += `${GLOBAL_TABLE_VAR}[1] = {}\n`;
        } else if (table === 2 && key === 1) {
             globalTableCreation += `${GLOBAL_TABLE_VAR}[2] = {}\n`;
        }

        const encryptedB64 = xorEncrypt(globalName, encryptionKey);
        globalTableCreation += `${GLOBAL_TABLE_VAR}[${table}][${key}] = ${DECRYPT_FUNC_VAR}('${encryptedB64}', '${encryptionKey}')\n`;
    });
    
    // Tạo bảng ánh xạ từ khóa (chỉ dùng cho mục đích giải mã trong runtime)
    let keywordMapCreation = `${KEYWORD_FUNC_VAR}('local') ${KEYWORD_MAP_VAR} = {}\n`;
    LUA_KEYWORDS.forEach(kw => {
        const encryptedB64 = xorEncrypt(kw, encryptionKey);
        keywordMapCreation += `${KEYWORD_MAP_VAR}["${kw}"] = ${DECRYPT_FUNC_VAR}('${encryptedB64}', '${encryptionKey}')\n`;
    });
    
    const keywordDecrypter = `
${KEYWORD_FUNC_VAR}('local') ${KEYWORD_FUNC_VAR} = ${KEYWORD_FUNC_VAR}('function') (key)
    ${KEYWORD_FUNC_VAR}('return') ${KEYWORD_MAP_VAR}[key]
${KEYWORD_FUNC_VAR}('end')
`;
    // Lưu ý: Các từ khóa trong hàm _D (local, return, end, for, in) không được mã hóa để đảm bảo hàm này chạy được.
    // Các từ khóa này sau đó bị ẩn bởi Control Flow Flattening ở code chính.

    return `
--[[ OBFUSCATED BY RENDER API (MAX STABLE) ]]
local function ${DECRYPT_FUNC_VAR}(e_b64, k)
    local success, e = pcall(string.fromBase64, e_b64)
    if not success or not e then return "" end
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

${globalTableCreation}
${keywordMapCreation}
${keywordDecrypter}
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
                const callExpression = `${DECRYPT_FUNC_VAR}('${encryptedB64}', '${ENCRYPTION_KEY}')`; 
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
            obfuscated_code: LUA_HEADER(ENCRYPTION_KEY) + "\n" + flattenedCode
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
                <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">Lua Obfuscator Max (STABLE)</h1>
                <p class="text-gray-400">Bảo mật tối đa: Mã hóa Từ khóa và Globals.</p>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <!-- CỘT TRÁI: INPUT & OUTPUT -->
                <div class="space-y-4">
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700">
                        <label class="block text-blue-300 font-bold mb-2 flex justify-between">
                            <span>1. Code Lua Gốc</span>
                            <span class="text-xs text-gray-500 font-normal">Input</span>
                        </label>
                        <textarea id="inputCode" class="w-full h-40 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-green-400 focus:outline-none focus:border-blue-500 transition">local welcomeMessage = "Chào mừng bạn!" local damageAmount = 50 local function applyDamage(target, amount) print("Mục tiêu bị trừ " .. tostring(amount) .. " máu.") end local player = game.Players.LocalPlayer print(welcomeMessage) applyDamage(player.Character.Humanoid, damageAmount)</textarea>
                    </div>
                    
                    <button onclick="doObfuscate()" id="btnObfus" class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95">
                        🛡️ MÃ HÓA TỐI ĐA (Obfuscate Max)
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
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700 border-t-4 border-t-red-500 h-full">
                        <label class="block text-red-400 font-bold mb-2">3. Công cụ Giải mã Chuỗi (Deobfuscator):</label>
                        <p class="text-xs text-gray-400 mb-3 font-bold text-yellow-300">⚠️ Vui lòng COPY TOÀN BỘ code đã mã hóa (bao gồm cả hàm _D ở đầu) vào ô dưới đây.</p>
                        
                        <!-- Ô NHẬP DEOBFUSCATE MỚI ĐỘC LẬP -->
                        <textarea id="deobfusInput" class="w-full h-48 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-gray-300 focus:outline-none focus:border-red-500 transition" placeholder="Dán code đã mã hóa vào đây để kiểm tra..."></textarea>

                        <button onclick="doDeobfuscate()" id="btnDeobfus" class="mt-3 w-full bg-red-900/50 hover:bg-red-900/80 text-red-200 font-bold py-2 px-4 rounded-xl border border-red-800 transition mb-3 transform hover:scale-[1.01] active:scale-95">
                            🔓 GIẢI MÃ CHUỖI ẨN (Decode Strings)
                        </button>
                        
                        <div id="deobfusResult" class="p-3 bg-black/50 rounded border border-gray-700 text-gray-300 font-mono text-xs max-h-48 overflow-y-auto hidden"></div>
                    </div>
                </div>
            </div>
        </div>

        <script>
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
                
                if(!input.trim()) {
                    alert("Vui lòng nhập code!");
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
                        // Tự động dán vào ô Deobfus để người dùng test ngay
                        document.getElementById('deobfusInput').value = data.obfuscated_code;
                        document.getElementById('deobfusResult').classList.add('hidden');
                    } else {
                        output.value = "LỖI: " + (data.error || data.details || "Không rõ");
                    }
                } catch(e) {
                    output.value = "Lỗi kết nối server: " + e.message;
                }
                btn.innerText = "🛡️ MÃ HÓA TỐI ĐA (Obfuscate Max)";
                btn.disabled = false;
                btn.classList.remove('opacity-50');
            }

            // --- LOGIC GIẢI MÃ CHUỖI TẠI TRÌNH DUYỆT (FIXED AND ROBUST) ---
            function doDeobfuscate() {
                const input = document.getElementById('deobfusInput').value;
                const resultDiv = document.getElementById('deobfusResult');
                
                if (!input.trim()) {
                    resultDiv.classList.remove('hidden');
                    resultDiv.innerHTML = "<b class='text-red-400'>Vui lòng dán code đã mã hóa vào ô trên.</b>";
                    return;
                }

                // Regex mạnh mẽ hơn để bắt _D('base64', 'key')
                // Bắt chính xác _D, theo sau là bất kỳ ký tự khoảng trắng nào, mở ngoặc, và các tham số chuỗi đơn/kép.
                const regex = /_D\s*\(\s*(['"])([^'"]+)\1\s*,\s*(['"])([^'"]+)\3\s*\)/g;
                
                let match;
                let foundCount = 0;
                let decodedStrings = [];

                while ((match = regex.exec(input)) !== null) {
                    foundCount++;
                    // match[2] là base64 data, match[4] là key
                    const b64 = match[2];
                    const key = match[4];
                    try {
                        const decodedStr = xorDecryptJS(b64, key);
                        // Chỉ hiển thị các chuỗi không phải là từ khóa Lua (đã biết trước)
                        if (!['local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do', 'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'repeat', 'until', 'print', 'game', 'Instance', 'wait', 'math', 'string', 'tostring', 'ipairs', 'pcall', 'Players', 'LocalPlayer', 'Character', 'Humanoid', 'CharacterAdded', 'TakeDamage', 'Name', 'Workspace'].includes(decodedStr)) {
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
                     resultDiv.innerHTML = "<b class='text-yellow-400'>Tìm thấy " + foundCount + " lệnh _D(), nhưng tất cả đều là các từ khóa Lua.</b> Vui lòng kiểm tra lại code gốc của bạn.";
                } else {
                    resultDiv.innerHTML = "<b class='text-red-400'>Không tìm thấy mẫu mã hóa hợp lệ (_D)</b>. Vui lòng đảm bảo bạn đã dán TOÀN BỘ code đã mã hóa.";
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
