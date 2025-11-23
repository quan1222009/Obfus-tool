// Script Node.js: Obfuscator API + Control Flow Flattening + Arithmetic Obfuscation
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json()); 

// --- 1. Cấu hình Luaparse an toàn ---
let luaparse;
try {
    luaparse = require('luaparse');
} catch (e) {
    console.error("CẢNH BÁO: Chưa cài luaparse.");
}

// --- 2. Logic Mã Hóa (Server Side) ---
const identifierMap = new Map();
const LUA_GLOBALS = new Set([
    'print', 'wait', 'game', 'script', 'workspace', 'math', 'string', 'table', 
    'require', 'local', 'function', 'end', 'if', 'then', 'else', 'for', 'in', 'while', 'do',
    'and', 'or', 'not', 'return', 'true', 'false', 'nil', 'pairs', 'ipairs', 'next', 
    'tostring', 'tonumber', 'pcall', 'xpcall', 'select', 'unpack', 'Instance', 'Vector3', 'CFrame',
    'Connect', 'Parent', 'Name', 'Value', 'Position', 'Magnitude'
]);

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

// Hàm mã hóa số học đơn giản
const obfuscateNumber = (num) => {
    // Nếu số quá nhỏ hoặc không phải số, giữ nguyên
    if (typeof num !== 'number' || Math.abs(num) < 1) return num;

    const key1 = Math.floor(Math.random() * 10) + 2; // 2-11
    const key2 = num - key1;
    // Mã hóa thành: (key1 + key2)
    return `(${key1} + ${key2})`;
};


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
            if (Array.isArray(child)) child.forEach(traverseAndRename);
            else traverseAndRename(child);
        }
    }
}

// Làm phẳng luồng điều khiển nâng cấp
function controlFlowFlatten(code) {
    const stateVar = generateRandomIdentifier();
    const dispatcher = generateRandomIdentifier();
    const funcName = generateRandomIdentifier();

    // Thêm các biến số ngẫu nhiên để làm code rối hơn
    const junkVar1 = generateRandomIdentifier();
    const junkVar2 = generateRandomIdentifier();

    const flattenedCode = `
local ${stateVar} = 1
local ${junkVar1} = math.random(100)
local ${junkVar2} = ${junkVar1} * 2
local ${dispatcher} = {
    [1] = function() -- Khối code chính
        -- Kiểm tra giá trị vô nghĩa để làm rối
        if ${junkVar1} > 200 then return end
${code}
        ${stateVar} = 0 -- Chuyển trạng thái kết thúc
    end,
    -- Thêm các khối code rỗng (dead code)
    [2] = function() local x = 1/0 end,
    [3] = function() print(${junkVar2}) end,
    [4] = function() ${junkVar1} = ${junkVar1} + 1 end,
    [5] = function() return end,
}
local ${funcName} = ${dispatcher}[${stateVar}]
-- Vòng lặp điều khiển chính
while ${stateVar} ~= 0 and ${funcName} do
    local success, err = pcall(${funcName})
    if not success then ${stateVar} = 0 end
    ${funcName} = ${dispatcher}[${stateVar}]
    if not ${funcName} then break end -- Phá vỡ vòng lặp nếu hết
end
`;
    return flattenedCode;
}

const LUA_DECRYPTOR_HEADER = `
--[[ OBFUSCATED BY RENDER API (PRO) ]]
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

// --- 3. API Endpoint ---
app.post('/obfuscate', (req, res) => {
    const luaCode = req.body.lua_code;
    if (!luaCode || typeof luaCode !== 'string') return res.status(400).json({ error: "Thiếu code Lua." });
    if (!luaparse) return res.status(500).json({ error: "Lỗi Server: Thiếu thư viện luaparse." });

    identifierMap.clear();
    const ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    
    try {
        // BƯỚC 1: Thu thập và thay thế chuỗi & số
        const tokensToReplace = []; // Chứa { type: 'string'/'number', value: ..., start: ..., end: ... }

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
                const callExpression = `_D('${encryptedB64}', '${ENCRYPTION_KEY}')`; 
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

        // BƯỚC 2: Đổi tên biến (Renaming)
        const astForRenaming = luaparse.parse(currentCode, { comments: false, locations: false });
        traverseAndRename(astForRenaming);

        let codeAfterRenaming = currentCode;
        identifierMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            codeAfterRenaming = codeAfterRenaming.replace(regex, newName);
        });

        // BƯỚC 3: Làm phẳng luồng điều khiển (Control Flow Flattening)
        const flattenedCode = controlFlowFlatten(codeAfterRenaming);

        res.json({
            success: true,
            obfuscated_code: LUA_DECRYPTOR_HEADER + "\n" + flattenedCode
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
                <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">Lua Obfuscator Pro</h1>
                <p class="text-gray-400">Bảo vệ code Roblox của bạn (Nâng cấp bảo mật)</p>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <!-- CỘT TRÁI: INPUT & OUTPUT -->
                <div class="space-y-4">
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700">
                        <label class="block text-blue-300 font-bold mb-2 flex justify-between">
                            <span>1. Code Lua Gốc</span>
                            <span class="text-xs text-gray-500 font-normal">Input</span>
                        </label>
                        <!-- Code mẫu đã được chèn sẵn cho lần đầu mở -->
                        <textarea id="inputCode" class="w-full h-40 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-green-400 focus:outline-none focus:border-blue-500 transition">local welcomeMessage = "Chào mừng bạn!" local damageAmount = 50 local function applyDamage(target, amount) print("Mục tiêu bị trừ " .. tostring(amount) .. " máu.") end local player = game.Players.LocalPlayer print(welcomeMessage) applyDamage(player.Character.Humanoid, damageAmount)</textarea>
                    </div>
                    
                    <button onclick="doObfuscate()" id="btnObfus" class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95">
                        🛡️ MÃ HÓA NGAY (Obfuscate)
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

                <!-- CỘT PHẢI: CÔNG CỤ DEOBFUSCATOR (FIXED INPUT) -->
                <div class="space-y-4">
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700 border-t-4 border-t-red-500 h-full">
                        <label class="block text-red-400 font-bold mb-2">3. Công cụ Giải mã Chuỗi (Deobfuscator):</label>
                        <p class="text-xs text-gray-400 mb-3">Dán code đã mã hóa (bao gồm hàm _D) vào ô dưới đây để xem các chuỗi ẩn. [FIXED]</p>
                        
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
                btn.innerText = "🛡️ MÃ HÓA NGAY (Obfuscate)";
                btn.disabled = false;
                btn.classList.remove('opacity-50');
            }

            // --- LOGIC GIẢI MÃ TẠI TRÌNH DUYỆT (FIXED) ---
            function doDeobfuscate() {
                const input = document.getElementById('deobfusInput').value;
                const resultDiv = document.getElementById('deobfusResult');
                
                if (!input.trim()) {
                    resultDiv.classList.remove('hidden');
                    resultDiv.innerHTML = "<b class='text-red-400'>Vui lòng dán code đã mã hóa vào ô trên.</b>";
                    return;
                }

                // Regex để bắt _D('base64', 'key')
                const regex = /_D\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
                
                let match;
                let foundCount = 0;
                let decodedStrings = [];

                while ((match = regex.exec(input)) !== null) {
                    foundCount++;
                    const b64 = match[1];
                    const key = match[2];
                    try {
                        const decodedStr = xorDecryptJS(b64, key);
                        decodedStrings.push(\`[\${foundCount}] "\${decodedStr}"\`);
                    } catch(e) {
                        decodedStrings.push(\`[\${foundCount}] <span class="text-red-400">(Lỗi giải mã chuỗi)</span>\`);
                    }
                }

                resultDiv.classList.remove('hidden');
                if(foundCount > 0) {
                    resultDiv.innerHTML = "<b class='text-green-400'>Tìm thấy " + foundCount + " chuỗi ẩn:</b><br>" + decodedStrings.join('<br>');
                } else {
                    resultDiv.innerHTML = "<b class='text-red-400'>Không tìm thấy mẫu mã hóa hợp lệ (_D)</b> trong đoạn code này.";
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
