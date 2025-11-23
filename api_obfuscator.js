// Script Node.js: Obfuscator API + Giao Diện Web (FIXED COPY & DEOBFUSCATE)
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
    'Connect', 'Parent', 'Name', 'Value'
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
            // Sử dụng dấu ngoặc đơn cho tham số để tránh lỗi escape string
            const callExpression = `_D('${encryptedB64}', '${ENCRYPTION_KEY}')`; 
            
            const before = obfuscatedWithStrings.substring(0, str.start);
            const after = obfuscatedWithStrings.substring(str.end);
            obfuscatedWithStrings = before + callExpression + after;
        });

        // BƯỚC C: Đổi tên biến
        const astForRenaming = luaparse.parse(obfuscatedWithStrings, { comments: false, locations: false });
        traverseAndRename(astForRenaming);

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
        res.status(400).json({ error: "Lỗi cú pháp Lua.", details: error.message });
    }
});

// --- 4. GIAO DIỆN WEB (Đã thêm Nút Copy & Fix Deobfuscate) ---
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
            /* Hiệu ứng cho nút Copy */
            .copied { background-color: #22c55e !important; }
        </style>
    </head>
    <body class="bg-gray-900 text-gray-100 font-sans p-4 md:p-8">
        <div class="max-w-5xl mx-auto">
            <header class="text-center mb-10">
                <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">Lua Obfuscator</h1>
                <p class="text-gray-400">Bảo vệ code Roblox của bạn (Luraph Style)</p>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <!-- CỘT TRÁI: INPUT -->
                <div class="space-y-4">
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700">
                        <label class="block text-blue-300 font-bold mb-2 flex justify-between">
                            <span>1. Code Gốc</span>
                            <span class="text-xs text-gray-500 font-normal">Lua Input</span>
                        </label>
                        <textarea id="inputCode" class="w-full h-64 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-green-400 focus:outline-none focus:border-blue-500 transition" placeholder='print("Hello Roblox")'></textarea>
                    </div>
                    
                    <button onclick="doObfuscate()" id="btnObfus" class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-95">
                        🛡️ MÃ HÓA NGAY
                    </button>
                </div>

                <!-- CỘT PHẢI: OUTPUT & TOOLS -->
                <div class="space-y-4">
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700 relative">
                        <label class="block text-yellow-300 font-bold mb-2 flex justify-between">
                            <span>2. Kết Quả</span>
                            <span class="text-xs text-gray-500 font-normal">Obfuscated Output</span>
                        </label>
                        <textarea id="outputCode" class="w-full h-64 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm font-mono text-yellow-400 focus:outline-none" readonly placeholder="Code đã mã hóa sẽ hiện ở đây..."></textarea>
                        
                        <!-- NÚT COPY MỚI -->
                        <button onclick="copyToClipboard()" id="btnCopy" class="absolute top-12 right-7 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1 px-3 rounded border border-gray-500 transition">
                            📋 COPY
                        </button>
                    </div>

                    <!-- CÔNG CỤ KIỂM TRA (DEOBFUSCATOR) -->
                    <div class="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700 border-t-4 border-t-red-500">
                        <label class="block text-red-400 font-bold mb-2">3. Kiểm tra Giải mã (Deobfuscator):</label>
                        <p class="text-xs text-gray-400 mb-3">Dán code đã mã hóa vào ô Kết Quả ở trên, sau đó bấm nút này để xem các chuỗi ẩn.</p>
                        
                        <button onclick="doDeobfuscate()" class="w-full bg-red-900/50 hover:bg-red-900/80 text-red-200 font-bold py-2 px-4 rounded-lg border border-red-800 transition mb-3">
                            🔓 GIẢI MÃ CHUỖI ẨN
                        </button>
                        
                        <div id="deobfusResult" class="p-3 bg-black/50 rounded border border-gray-700 text-gray-300 font-mono text-xs max-h-32 overflow-y-auto hidden"></div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // --- LOGIC COPY ---
            function copyToClipboard() {
                const output = document.getElementById('outputCode');
                if (!output.value) return;
                
                output.select();
                output.setSelectionRange(0, 99999); // Cho mobile
                navigator.clipboard.writeText(output.value).then(() => {
                    const btn = document.getElementById('btnCopy');
                    const originalText = btn.innerText;
                    btn.innerText = "✅ ĐÃ COPY";
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    alert("Không thể copy: " + err);
                });
            }

            // --- LOGIC GỌI API ---
            async function doObfuscate() {
                const btn = document.getElementById('btnObfus');
                const input = document.getElementById('inputCode').value;
                const output = document.getElementById('outputCode');
                
                if(!input.trim()) return alert("Vui lòng nhập code!");

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
                    } else {
                        output.value = "LỖI: " + (data.error || data.details);
                    }
                } catch(e) {
                    output.value = "Lỗi kết nối server: " + e.message;
                }
                btn.innerText = "🛡️ MÃ HÓA NGAY";
                btn.disabled = false;
                btn.classList.remove('opacity-50');
            }

            // --- LOGIC GIẢI MÃ TẠI TRÌNH DUYỆT (FIXED) ---
            function doDeobfuscate() {
                // Lấy dữ liệu từ ô OUTPUT (nơi chứa code mã hóa)
                const input = document.getElementById('outputCode').value;
                const resultDiv = document.getElementById('deobfusResult');
                
                if (!input.trim()) {
                    resultDiv.classList.remove('hidden');
                    resultDiv.innerText = "Vui lòng có code đã mã hóa ở ô 'Kết Quả' để giải mã.";
                    return;
                }

                // Regex mới để bắt _D('base64', 'key') - hỗ trợ cả nháy đơn và nháy kép
                // Cấu trúc: _D ( ' ... ' , ' ... ' )
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
                        decodedStrings.push(\`[\${foundCount}] (Lỗi giải mã: \${e.message})\`);
                    }
                }

                resultDiv.classList.remove('hidden');
                if(foundCount > 0) {
                    resultDiv.innerHTML = "<b class='text-green-400'>Tìm thấy " + foundCount + " chuỗi ẩn:</b><br>" + decodedStrings.join('<br>');
                } else {
                    resultDiv.innerText = "Không tìm thấy mẫu mã hóa hợp lệ (_D) trong đoạn code này.";
                }
            }

            // Hàm giải mã JS tương đương với Lua
            function xorDecryptJS(b64, key) {
                // Giải mã Base64 thành chuỗi nhị phân
                const binaryString = atob(b64);
                let result = "";
                const kLen = key.length;
                
                for (let i = 0; i < binaryString.length; i++) {
                    const charCode = binaryString.charCodeAt(i);
                    // Lấy mã char của key, tương đương với Lua logic
                    const keyChar = key.charCodeAt(i % kLen);
                    
                    // XOR
                    result += String.fromCharCode(charCode ^ keyChar);
                }
                // Chuyển đổi UTF-8 nếu cần (cho tiếng Việt)
                try {
                    return decodeURIComponent(escape(result));
                } catch(e) {
                    return result; // Trả về raw nếu không phải UTF-8 chuẩn
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
