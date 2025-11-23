// Script Node.js: Obfuscator API + Giao Diện Web
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
    'tostring', 'tonumber', 'pcall', 'xpcall', 'select', 'unpack', 'Instance', 'Vector3', 'CFrame'
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

// --- 3. API Endpoint ---
app.post('/obfuscate', (req, res) => {
    const luaCode = req.body.lua_code;
    if (!luaCode || typeof luaCode !== 'string') return res.status(400).json({ error: "Thiếu code Lua." });
    if (!luaparse) return res.status(500).json({ error: "Lỗi Server: Thiếu thư viện luaparse." });

    identifierMap.clear();
    const ENCRYPTION_KEY = generateRandomIdentifier().substring(0, 8); 
    
    try {
        const stringsToEncrypt = [];
        luaparse.parse(luaCode, { comments: false, locations: true, onCreateNode: function(node) {
            if (node.type === 'StringLiteral' && node.loc) {
                stringsToEncrypt.push({ value: node.value, start: node.loc.start.offset, end: node.loc.end.offset });
            }
        }});

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

        const astForRenaming = luaparse.parse(obfuscatedWithStrings, { comments: false, locations: false });
        traverseAndRename(astForRenaming);

        let finalCode = obfuscatedWithStrings;
        identifierMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            finalCode = finalCode.replace(regex, newName);
        });

        res.json({ success: true, obfuscated_code: LUA_DECRYPTOR_HEADER + "\n" + finalCode });

    } catch (error) {
        res.status(400).json({ error: "Lỗi cú pháp Lua.", details: error.message });
    }
});

// --- 4. GIAO DIỆN WEB (HTML/JS Client) ---
// Đây là phần giúp hiển thị Menu và Nút bấm
app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Roblox Lua Obfuscator</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-900 text-white font-sans p-6">
        <div class="max-w-4xl mx-auto">
            <header class="text-center mb-8">
                <h1 class="text-3xl font-bold text-blue-400">Lua Obfuscator (Luraph Style)</h1>
                <p class="text-gray-400">Mã hóa chuỗi & Đổi tên biến</p>
            </header>

            <div class="grid grid-cols-1 gap-6">
                <!-- PHẦN 1: NHẬP CODE GỐC -->
                <div class="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <label class="block text-blue-300 font-bold mb-2">1. Nhập Code Lua Gốc:</label>
                    <textarea id="inputCode" class="w-full h-40 bg-slate-900 border border-slate-600 rounded p-2 text-sm font-mono text-green-400 focus:outline-none focus:border-blue-500" placeholder='print("Hello Roblox")'></textarea>
                    <button onclick="doObfuscate()" id="btnObfus" class="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition">
                        🛡️ MÃ HÓA CODE (OBFUSCATE)
                    </button>
                </div>

                <!-- PHẦN 2: KẾT QUẢ MÃ HÓA -->
                <div class="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <label class="block text-yellow-300 font-bold mb-2">2. Kết Quả (Copy code này vào Roblox):</label>
                    <textarea id="outputCode" class="w-full h-64 bg-slate-900 border border-slate-600 rounded p-2 text-sm font-mono text-yellow-400 focus:outline-none" readonly placeholder="Code đã mã hóa sẽ hiện ở đây..."></textarea>
                </div>

                <!-- PHẦN 3: GIẢI MÃ THỬ NGHIỆM (Client Side) -->
                <div class="bg-slate-800 p-4 rounded-lg border border-slate-700 opacity-90">
                    <label class="block text-red-300 font-bold mb-2">3. Giải Mã Thử Nghiệm (Web Deobfuscator):</label>
                    <p class="text-xs text-gray-400 mb-2">*Chỉ giải mã được các chuỗi trong code đã obfuscate bởi công cụ này.</p>
                    <textarea id="deobfusInput" class="w-full h-24 bg-slate-900 border border-slate-600 rounded p-2 text-sm font-mono text-gray-300" placeholder="Dán code đã mã hóa vào đây để test giải mã..."></textarea>
                    <button onclick="doDeobfuscate()" class="mt-3 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">
                        🔓 GIẢI MÃ CHUỖI (DEOBFUSCATE)
                    </button>
                    <div id="deobfusResult" class="mt-3 p-2 bg-black rounded text-green-300 font-mono text-sm min-h-[2rem] hidden"></div>
                </div>
            </div>
        </div>

        <script>
            // LOGIC GỌI API SERVER
            async function doObfuscate() {
                const btn = document.getElementById('btnObfus');
                const input = document.getElementById('inputCode').value;
                const output = document.getElementById('outputCode');
                
                if(!input.trim()) return alert("Vui lòng nhập code!");

                btn.innerText = "Đang xử lý...";
                btn.disabled = true;

                try {
                    const res = await fetch('/obfuscate', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ lua_code: input })
                    });
                    const data = await res.json();
                    
                    if(data.success) {
                        output.value = data.obfuscated_code;
                    } else {
                        output.value = "LỖI: " + (data.error || data.details);
                    }
                } catch(e) {
                    output.value = "Lỗi kết nối: " + e.message;
                }
                btn.innerText = "🛡️ MÃ HÓA CODE (OBFUSCATE)";
                btn.disabled = false;
            }

            // LOGIC GIẢI MÃ TẠI TRÌNH DUYỆT (Mô phỏng Lua)
            function doDeobfuscate() {
                const input = document.getElementById('deobfusInput').value;
                const resultDiv = document.getElementById('deobfusResult');
                
                // Tìm các lệnh gọi _D("base64", "key")
                const regex = /_D\\("([^"]+)", "([^"]+)"\\)/g;
                let match;
                let found = false;
                let decodedStrings = [];

                while ((match = regex.exec(input)) !== null) {
                    found = true;
                    const b64 = match[1];
                    const key = match[2];
                    try {
                        const decodedStr = xorDecryptJS(b64, key);
                        decodedStrings.push(decodedStr);
                    } catch(e) {
                        decodedStrings.push("[Lỗi giải mã]");
                    }
                }

                resultDiv.classList.remove('hidden');
                if(found) {
                    resultDiv.innerHTML = "<b>Tìm thấy chuỗi ẩn:</b><br>" + decodedStrings.map(s => \`• "\${s}"\`).join('<br>');
                } else {
                    resultDiv.innerText = "Không tìm thấy mẫu mã hóa hợp lệ (_D) trong đoạn code này.";
                }
            }

            // Hàm giải mã JS (Mô phỏng logic Lua)
            function xorDecryptJS(b64, key) {
                const binaryString = atob(b64);
                let result = "";
                const kLen = key.length;
                for (let i = 0; i < binaryString.length; i++) {
                    const charCode = binaryString.charCodeAt(i);
                    const keyChar = key.charCodeAt(i % kLen);
                    result += String.fromCharCode(charCode ^ keyChar);
                }
                return result;
            }
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
