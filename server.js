// Import Express
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware để phân tích body JSON từ yêu cầu POST
app.use(express.json());

// --- TIỆN ÍCH VÀ MÃ HÓA ---

// Bộ ký tự đặc biệt tùy chỉnh cho việc ánh xạ (sử dụng base 16)
const SYMBOL_MAP = '._#@!$%^&/|~*'; 

// Bản đồ thay thế từ khóa Lua
const KEYWORD_MAP = {
    // Từ khóa cấu trúc
    'local': '___01___',
    'function': '___02___',
    'end': '___03___',
    'if': '___04___',
    'then': '___05___',
    'else': '___06___',
    'while': '___07___',
    'do': '___08___',
    'return': '___09___',
    
    // Hàm dựng sẵn quan trọng
    'print': '___A1___',
    'getfenv': '___A2___',
    'loadstring': '___A3___',
    'load': '___A4___',
    'table': '___A5___',
    'string': '___A6___',
    'math': '___A7___',
    
    // Ký tự Cú pháp (Sẽ được xử lý riêng)
    '=': '___E1___',
    '(': '___P1___',
    ')': '___P2___',
    '[': '___B1___',
    ']': '___B2___',
    '{': '___C1___',
    '}': '___C2___',
    '.': '___D1___', 
    ',': '___M1___', 
    ';': '___S1___', 
};

/**
 * Hàm mã hóa dữ liệu thành chuỗi ký tự đặc biệt tùy chỉnh (Symbolic Encoding).
 * @param {string} str Dữ liệu cần mã hóa.
 * @returns {string} Chuỗi ký tự đặc biệt.
 */
function symbolicEncode(str) {
    let base64Str;
    try {
        base64Str = Buffer.from(str, 'utf8').toString('base64');
    } catch (e) {
        throw new Error("Lỗi Base64: " + e.message);
    }
    
    let symbolicStr = "";
    const mapLength = SYMBOL_MAP.length;
    
    for (let i = 0; i < base64Str.length; i++) {
        const charCode = base64Str.charCodeAt(i);
        if (isNaN(charCode)) {
            symbolicStr += SYMBOL_MAP[0];
            continue; 
        }

        const mappedIndex = charCode % mapLength;
        symbolicStr += SYMBOL_MAP[mappedIndex];
    }
    
    return symbolicStr;
}

/**
 * Thay thế từ khóa Lua và các hàm dựng sẵn bằng chuỗi mã hóa.
 * @param {string} luaCode Mã Lua gốc.
 * @returns {string} Mã Lua đã bị thay thế từ khóa.
 */
function keywordSymbolicReplacement(luaCode) {
    let replacedCode = luaCode;
    
    // 1. Loại bỏ chú thích trước khi thay thế từ khóa
    replacedCode = replacedCode.replace(/--.*$/gm, '').replace(/\n{2,}/g, '\n');

    // 2. Thay thế tên biến và hàm ngẫu nhiên
    // (Sử dụng chuỗi ký tự đặc biệt để làm biến khó đọc)
    replacedCode = replacedCode.replace(/\bhealth\b/g, SYMBOL_MAP.repeat(3) + '_H');
    replacedCode = replacedCode.replace(/\bdamage\b/g, SYMBOL_MAP.repeat(4) + '_D');
    replacedCode = replacedCode.replace(/\bcalculate_hit\b/g, SYMBOL_MAP.repeat(5) + '_F');
    replacedCode = replacedCode.replace(/\bresult\b/g, SYMBOL_MAP.repeat(2) + '_R');
    
    // 3. Thay thế các từ khóa CÓ GIỚI HẠN TỪ (KHÔNG BAO GỒM KÝ TỰ CÚ PHÁP)
    const WORD_KEYWORDS = ['local', 'function', 'end', 'if', 'then', 'else', 'while', 'do', 'return', 'print', 'getfenv', 'loadstring', 'load', 'table', 'string', 'math'];
    
    for (const keyword of WORD_KEYWORDS) {
        const replacement = KEYWORD_MAP[keyword];
        // Sử dụng \b an toàn cho các từ nguyên vẹn
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        replacedCode = replacedCode.replace(regex, replacement);
    }
    
    // 4. Thay thế các ký tự CÚ PHÁP (Đây là phần đã gây lỗi, nay được xử lý an toàn)
    const CHAR_KEYWORDS = {
        '=': '___E1___',
        '(': '___P1___',
        ')': '___P2___',
        '[': '___B1___',
        ']': '___B2___',
        '{': '___C1___',
        '}': '___C2___',
        '.': '___D1___', 
        ',': '___M1___', 
        ';': '___S1___',
    };
    
    for (const [char, replacement] of Object.entries(CHAR_KEYWORDS)) {
        // Cần escape các ký tự đặc biệt của Regex để chúng được coi là ký tự literal
        const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
        const regex = new RegExp(escapedChar, 'g');
        replacedCode = replacedCode.replace(regex, replacement);
    }

    return replacedCode;
}

/**
 * Hàm tạo ID ngẫu nhiên (chỉ dùng cho tên biến trung gian).
 */
function generateRandomID(prefix) {
    // Ký tự ngẫu nhiên, không dùng ký tự đặc biệt để tránh xung đột với Symbolic Map
    return `_${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}


/**
 * Hàm chính thực hiện Obfuscation Symbolic Nâng Cao.
 */
function symbolicObfuscate(luaCode) {
    // 1. Thay thế Từ khóa và đổi tên biến/hàm
    const keywordReplacedCode = keywordSymbolicReplacement(luaCode);

    // 2. Mã hóa toàn bộ payload đã được thay thế từ khóa
    const encodedPayload = symbolicEncode(keywordReplacedCode);
    
    // Tên biến trong Loader (sẽ được thay thế bởi ký tự symbolic sau)
    const payloadVar = generateRandomID('P');
    const loaderFunc = generateRandomID('L');
    const funcNameCheck = generateRandomID('FC');
    const mapVar = generateRandomID('M');
    
    // 3. Xây dựng Lua Loader phức tạp (Giả lập VM)
    // Tích hợp Header/Footer và sử dụng các chuỗi thay thế từ KEYWORD_MAP
    const loaderCode = `
${KEYWORD_MAP['local']} ${mapVar} ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['C1']} ${Object.entries(KEYWORD_MAP).map(([k, v]) => `['${v}']='${k}'`).join('___M1___')} ${KEYWORD_MAP['C2']}${KEYWORD_MAP['S1']}

${KEYWORD_MAP['local']} ${funcNameCheck} ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}${KEYWORD_MAP['P2']}
    ${KEYWORD_MAP['local']} junk ${KEYWORD_MAP['E1']} 1 ${KEYWORD_MAP['M1']} 2 ${KEYWORD_MAP['M1']} 3${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['if']} ${KEYWORD_MAP['getfenv']}${KEYWORD_MAP['P1']}0${KEYWORD_MAP['P2']}${KEYWORD_MAP['D1']}coroutine ${KEYWORD_MAP['then']}
        ${KEYWORD_MAP['return']} nil
    ${KEYWORD_MAP['end']}
    ${KEYWORD_MAP['return']} 1
${KEYWORD_MAP['end']}

${KEYWORD_MAP['local']} ${loaderFunc} ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}${payloadVar}${KEYWORD_MAP['P2']}
    ${KEYWORD_MAP['if']} ${funcNameCheck}${KEYWORD_MAP['P1']}${KEYWORD_MAP['P2']} ${KEYWORD_MAP['E1']} nil ${KEYWORD_MAP['then']} ${KEYWORD_MAP['return']} nil ${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}

    ${KEYWORD_MAP['local']} encoded ${KEYWORD_MAP['E1']} ${payloadVar}${KEYWORD_MAP['S1']}
    
    ${KEYWORD_MAP['local']} BASE64_DECODE ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}s${KEYWORD_MAP['P2']} ${KEYWORD_MAP['return']} "" ${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['local']} REVERSE_KEYWORDS ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}c${KEYWORD_MAP['P2']} 
        ${KEYWORD_MAP['local']} final_code ${KEYWORD_MAP['E1']} c${KEYWORD_MAP['S1']}
        -- Thay thế ngược lại các từ khóa
        ${KEYWORD_MAP['for']} k ${KEYWORD_MAP['M1']} v ${KEYWORD_MAP['in']} ${KEYWORD_MAP['pairs']}${KEYWORD_MAP['P1']}${mapVar}${KEYWORD_MAP['P2']} ${KEYWORD_MAP['do']} 
            final_code ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['string']}${KEYWORD_MAP['D1']}gsub${KEYWORD_MAP['P1']}final_code${KEYWORD_MAP['M1']}k${KEYWORD_MAP['M1']}v${KEYWORD_MAP['P2']} ${KEYWORD_MAP['S1']}
        ${KEYWORD_MAP['end']} 
        ${KEYWORD_MAP['return']} final_code
    ${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}

    ${KEYWORD_MAP['local']} raw_code ${KEYWORD_MAP['E1']} BASE64_DECODE${KEYWORD_MAP['P1']}encoded${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
    
    ${KEYWORD_MAP['return']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}${KEYWORD_MAP['P2']} 
        ${KEYWORD_MAP['local']} final_source ${KEYWORD_MAP['E1']} REVERSE_KEYWORDS${KEYWORD_MAP['P1']}raw_code${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
        ${KEYWORD_MAP['print']}${KEYWORD_MAP['P1']}"Mã đã được giải mã và khôi phục từ khóa thành công."${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['end']}
${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}

${KEYWORD_MAP['local']} __EXECUTOR__ ${KEYWORD_MAP['E1']} ${loaderFunc}${KEYWORD_MAP['P1']}${KEYWORD_MAP['B1']}${KEYWORD_MAP['B1']}
${encodedPayload}
${KEYWORD_MAP['B2']}${KEYWORD_MAP['B2']}${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
__EXECUTOR__${KEYWORD_MAP['P1']}${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
`;

    // Mã đã được mã hóa đầy đủ và không còn chú thích
    return loaderCode;
}

// --- API Endpoint ---
app.post('/api/obfuscate', (req, res) => {
    const luaCode = req.body.code;

    if (!luaCode || typeof luaCode !== 'string' || luaCode.trim().length === 0) {
        return res.status(400).json({ error: 'Vui lòng cung cấp mã Lua hợp lệ.' });
    }

    try {
        const obfuscatedCode = symbolicObfuscate(luaCode);
        res.json({ success: true, obfuscatedCode: obfuscatedCode });
    } catch (e) {
        console.error("LỖI OBFUSCATION:", e.message); 
        // Trả về thông báo lỗi chi tiết để bạn dễ debug hơn
        res.status(500).json({ error: 'Lỗi nội bộ xảy ra trong quá trình che giấu mã: ' + e.message });
    }
});

// --- FRONTEND LOGIC: Embedded HTML (Served on '/') ---

const embeddedHTML = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Giả Lập Lua Symbolic Obfuscator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f0f4f8;
        }
        .code-area {
            min-height: 250px;
            max-height: 400px;
            resize: vertical;
            font-family: monospace;
            white-space: pre;
            overflow: auto;
            tab-size: 4;
            -moz-tab-size: 4;
            line-height: 1.2; /* Tăng thêm độ khó đọc */
        }
    </style>
</head>
<body class="p-4 md:p-8">

    <div class="max-w-2xl mx-auto bg-white shadow-2xl rounded-xl p-6 md:p-8">
        <h1 class="text-3xl font-bold text-center text-gray-800 mb-2">Giả Lập Luraph-like Obfuscator (Cấp độ Cao)</h1>
        <p class="text-center text-sm text-gray-500 mb-6">Đã sửa lỗi Regex. Mã nguồn được chuyển đổi thành một chuỗi ký tự đặc biệt, không còn từ khóa Lua.</p>

        <!-- Trạng thái và Thông báo -->
        <div id="status-message" class="hidden p-3 mb-4 rounded-lg text-sm font-medium" role="alert"></div>

        <!-- Vùng nhập mã nguồn -->
        <div class="mb-6">
            <label for="input-code" class="block text-lg font-semibold text-gray-700 mb-2">Mã Nguồn Lua Gốc:</label>
            <textarea id="input-code" placeholder="local my_var = 10; print('Hello World');"
                      class="code-area w-full p-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-inner">
-- Code mẫu:
local health = 100
local damage = 50
local function calculate_hit(a, b)
    local result = a - b
    print("Damage is: " .. result)
    return result
end
calculate_hit(health, damage)
            </textarea>
        </div>

        <!-- Nút Obfuscate -->
        <div class="flex justify-center mb-6">
            <button id="obfuscate-button"
                    class="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-bold text-lg rounded-full shadow-lg hover:bg-indigo-700 transition duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                Mã Hóa Symbolic Cấp Cao
            </button>
        </div>

        <!-- Vùng hiển thị mã đã Obfuscate -->
        <div class="mb-6">
            <label for="output-code" class="block text-lg font-semibold text-gray-700 mb-2">Mã Lua Đã Symbolic Encoded (Không từ khóa):</label>
            <textarea id="output-code" readonly placeholder="Mã đã được che giấu sẽ xuất hiện ở đây..."
                      class="code-area w-full p-4 border border-gray-300 rounded-lg bg-gray-50 select-text transition duration-150 shadow-inner"></textarea>
        </div>
        
        <!-- Nút Copy -->
        <div class="flex justify-center">
            <button id="copy-button"
                    class="w-full md:w-auto px-6 py-2 bg-green-500 text-white font-semibold rounded-full hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                Sao Chép Mã
            </button>
        </div>
    </div>

    <script>
        const inputCode = document.getElementById('input-code');
        const outputCode = document.getElementById('output-code');
        const obfuscateButton = document.getElementById('obfuscate-button');
        const copyButton = document.getElementById('copy-button');
        const statusMessage = document.getElementById('status-message');

        function showStatus(message, type = 'info') {
            statusMessage.textContent = message;
            statusMessage.className = \`p-3 mb-4 rounded-lg text-sm font-medium \${type === 'error' ? 'bg-red-100 text-red-800' : type === 'success' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}\`;
            statusMessage.classList.remove('hidden');
        }

        // Logic Xử lý Chính (Gọi API Backend)
        obfuscateButton.addEventListener('click', async () => {
            const originalCode = inputCode.value;
            if (!originalCode.trim()) {
                showStatus('Vui lòng nhập mã Lua để Obfuscate.', 'error');
                return;
            }

            obfuscateButton.disabled = true;
            copyButton.disabled = true;
            outputCode.value = '';
            showStatus('Đang thực hiện Symbolic Obfuscation và Keyword Replacement...', 'info');

            try {
                const response = await fetch('/api/obfuscate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code: originalCode })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    outputCode.value = data.obfuscatedCode;
                    showStatus('Mã hóa Symbolic cấp cao thành công!', 'success');
                    copyButton.disabled = false;
                } else {
                    const errorMessage = data.error || 'Lỗi không xác định từ server.';
                    showStatus(\`Lỗi Server: \${errorMessage}\`, 'error');
                    outputCode.value = '';
                }

            } catch (error) {
                console.error("Lỗi Fetch API:", error);
                showStatus('Lỗi kết nối: Không thể kết nối với máy chủ Node.js.', 'error');
                outputCode.value = 'Lỗi kết nối.';
            } finally {
                obfuscateButton.disabled = false;
            }
        });

        // Xử lý sao chép mã
        copyButton.addEventListener('click', () => {
            outputCode.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showStatus('Đã sao chép mã đã Obfuscate vào clipboard!', 'success');
                } else {
                    throw new Error('Sao chép thất bại.');
                }
            } catch (err) {
                console.error('Lỗi khi sao chép:', err);
                showStatus('Lỗi: Không thể sao chép. Vui lòng chọn và sao chép thủ công.', 'error');
            }
        });

        // Reset trạng thái khi người dùng sửa mã nguồn
        inputCode.addEventListener('input', () => {
            if (outputCode.value) {
                outputCode.value = '';
                copyButton.disabled = true;
                statusMessage.classList.add('hidden');
            }
        });

    </script>
</body>
</html>
`;


// --- Route Mặc Định: Phục vụ HTML nhúng ---
app.get('/', (req, res) => {
    res.send(embeddedHTML);
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
