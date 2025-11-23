// Import Express
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware để phân tích body JSON từ yêu cầu POST
app.use(express.json());

// --- TIỆN ÍCH VÀ MÃ HÓA ---

// Bộ ký tự đặc biệt tùy chỉnh, chỉ dùng để đổi tên biến cho khó đọc
const SYMBOL_MAP = '._#@!$%^&/|~*'; 

// Bản đồ thay thế từ khóa Lua
const KEYWORD_MAP = {
    'local': '___01___',
    'function': '___02___',
    'end': '___03___',
    'if': '___04___',
    'then': '___05___',
    'else': '___06___',
    'while': '___07___',
    'do': '___08___',
    'return': '___09___',
    'print': '___A1___',
    'getfenv': '___A2___',
    'loadstring': '___A3___',
    'load': '___A4___',
    'table': '___A5___',
    'string': '___A6___',
    'math': '___A7___',
    'tonumber': '___A8___', // Thêm hàm cần thiết
    'pairs': '___A9___',    // Thêm hàm cần thiết
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
 * Chuyển đổi toàn bộ mã Lua thành chuỗi ký tự thoát Hex (\xNN) trong Lua.
 * Đây là bước mô phỏng việc mã hóa thành dữ liệu byte/nhị phân không thể đọc được.
 * @param {string} code Mã Lua đã được thay thế từ khóa.
 * @returns {string} Chuỗi ký tự thoát Hex trong Lua (Lua string literal).
 */
function toHexEscapeString(code) {
    let hexString = "";
    for (let i = 0; i < code.length; i++) {
        const charCode = code.charCodeAt(i);
        // Chuyển sang chuỗi Hex 2 chữ số (padding với 0 nếu cần)
        const hex = charCode.toString(16).padStart(2, '0');
        hexString += `\\x${hex}`;
    }
    return hexString;
}

/**
 * Thay thế từ khóa Lua và các hàm dựng sẵn bằng chuỗi mã hóa và loại bỏ chú thích.
 * @param {string} luaCode Mã Lua gốc.
 * @returns {string} Mã Lua đã bị thay thế từ khóa, không còn chú thích.
 */
function keywordSymbolicReplacement(luaCode) {
    let replacedCode = luaCode;
    
    // 1. Loại bỏ chú thích trước
    replacedCode = replacedCode.replace(/--.*$/gm, '').replace(/\n{2,}/g, '\n');

    // 2. Thay thế tên biến và hàm ngẫu nhiên
    // Đổi tên các biến chung trong code mẫu sang ký tự symbolic
    replacedCode = replacedCode.replace(/\bhealth\b/g, SYMBOL_MAP.repeat(3) + '_H');
    replacedCode = replacedCode.replace(/\bdamage\b/g, SYMBOL_MAP.repeat(4) + '_D');
    replacedCode = replacedCode.replace(/\bcalculate_hit\b/g, SYMBOL_MAP.repeat(5) + '_F');
    replacedCode = replacedCode.replace(/\bresult\b/g, SYMBOL_MAP.repeat(2) + '_R');
    
    // 3. Thay thế các từ khóa CÓ GIỚI HẠN TỪ
    const WORD_KEYWORDS = ['local', 'function', 'end', 'if', 'then', 'else', 'while', 'do', 'return', 'print', 'getfenv', 'loadstring', 'load', 'table', 'string', 'math', 'tonumber', 'pairs'];
    
    for (const keyword of WORD_KEYWORDS) {
        const replacement = KEYWORD_MAP[keyword];
        // Sử dụng \b an toàn cho các từ nguyên vẹn
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        replacedCode = replacedCode.replace(regex, replacement);
    }
    
    // 4. Thay thế các ký tự CÚ PHÁP
    const CHAR_KEYWORDS = {
        '=': '___E1___', '(': '___P1___', ')': '___P2___',
        '[': '___B1___', ']': '___B2___', '{': '___C1___',
        '}': '___C2___', '.': '___D1___', ',': '___M1___', 
        ';': '___S1___',
    };
    
    for (const [char, replacement] of Object.entries(CHAR_KEYWORDS)) {
        // Cần escape ký tự đặc biệt của Regex
        const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
        const regex = new RegExp(escapedChar, 'g');
        replacedCode = replacedCode.replace(regex, replacement);
    }

    return replacedCode;
}

/**
 * Hàm chính thực hiện Obfuscation.
 * @param {string} luaCode Mã Lua gốc.
 * @returns {string} Mã Lua đã che giấu (Binary Hex-Encoded).
 */
function symbolicObfuscate(luaCode) {
    // 1. Thay thế Từ khóa và đổi tên biến/hàm
    const keywordReplacedCode = keywordSymbolicReplacement(luaCode);

    // 2. Tạo Loader/VM giả lập bằng các từ khóa đã thay thế
    const mapVar = generateRandomID('M');
    const funcNameCheck = generateRandomID('FC');
    
    // Đây là mã Loader CẤP CAO (VM giả lập) đã bị thay thế từ khóa
    const loaderCode = `
${KEYWORD_MAP['local']} ${mapVar} ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['C1']} ${Object.entries(KEYWORD_MAP).map(([k, v]) => `['${v}']='${k}'`).join('___M1___')} ${KEYWORD_MAP['C2']}${KEYWORD_MAP['S1']}

${KEYWORD_MAP['local']} ${funcNameCheck} ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}${KEYWORD_MAP['P2']}
    ${KEYWORD_MAP['local']} junk ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['math']}${KEYWORD_MAP['D1']}random${KEYWORD_MAP['P1']}1${KEYWORD_MAP['M1']}10${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['if']} ${KEYWORD_MAP['getfenv']}${KEYWORD_MAP['P1']}0${KEYWORD_MAP['P2']}${KEYWORD_MAP['D1']}coroutine ${KEYWORD_MAP['then']}
        ${KEYWORD_MAP['return']} nil
    ${KEYWORD_MAP['end']}
    ${KEYWORD_MAP['return']} 1
${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}

${KEYWORD_MAP['local']} REVERSE_KEYWORDS ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}c${KEYWORD_MAP['P2']} 
    ${KEYWORD_MAP['local']} final_code ${KEYWORD_MAP['E1']} c${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['for']} k ${KEYWORD_MAP['M1']} v ${KEYWORD_MAP['in']} ${KEYWORD_MAP['pairs']}${KEYWORD_MAP['P1']}${mapVar}${KEYWORD_MAP['P2']} ${KEYWORD_MAP['do']} 
        final_code ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['string']}${KEYWORD_MAP['D1']}gsub${KEYWORD_MAP['P1']}final_code${KEYWORD_MAP['M1']}k${KEYWORD_MAP['M1']}v${KEYWORD_MAP['P2']} ${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['end']} 
    ${KEYWORD_MAP['return']} final_code
${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}

${KEYWORD_MAP['local']} EXEC ${KEYWORD_MAP['E1']} ${KEYWORD_MAP['function']}${KEYWORD_MAP['P1']}c${KEYWORD_MAP['P2']}
    ${KEYWORD_MAP['if']} ${funcNameCheck}${KEYWORD_MAP['P1']}${KEYWORD_MAP['P2']} ${KEYWORD_MAP['E1']} nil ${KEYWORD_MAP['then']} ${KEYWORD_MAP['return']} ${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['local']} code ${KEYWORD_MAP['E1']} REVERSE_KEYWORDS${KEYWORD_MAP['P1']}c${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
    ${KEYWORD_MAP['loadstring']}${KEYWORD_MAP['P1']}code${KEYWORD_MAP['P2']}${KEYWORD_MAP['P1']}${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
${KEYWORD_MAP['end']}${KEYWORD_MAP['S1']}

EXEC${KEYWORD_MAP['P1']}"${keywordReplacedCode}"${KEYWORD_MAP['P2']}${KEYWORD_MAP['S1']}
`;

    // 3. Chuyển đổi toàn bộ Loader Code thành Dữ liệu Nhị phân (Hex Escape String)
    const finalBinaryPayload = toHexEscapeString(loaderCode);

    // 4. Tạo Stub Loader CUỐI CÙNG (không còn từ khóa hay chú thích)
    // Stub này chỉ có nhiệm vụ giải mã Hex và chạy Load
    
    // Lưu ý: Các hàm Lua load, string, gsub, tonumber, string.char đều KHÔNG bị thay thế ở cấp độ này
    // để Stub Loader có thể chạy được.
    const stubVar = generateRandomID('S');
    const finalObfuscatedCode = `
local ${stubVar} = "${finalBinaryPayload}"
load(
    string.gsub(
        ${stubVar},
        "\\\\x(%x%x)",
        function(h) return string.char(tonumber(h, 16)) end
    )
)()
`;

    return finalObfuscatedCode;
}

function generateRandomID(prefix) {
    return `_${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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
            line-height: 1.2;
            word-break: break-all; /* Ngăn tràn ngang với chuỗi dài */
        }
    </style>
</head>
<body class="p-4 md:p-8">

    <div class="max-w-2xl mx-auto bg-white shadow-2xl rounded-xl p-6 md:p-8">
        <h1 class="text-3xl font-bold text-center text-gray-800 mb-2">Giả Lập Luraph-like Obfuscator (Mã Hóa Nhị Phân)</h1>
        <p class="text-center text-sm text-gray-500 mb-6">Mã nguồn được chuyển đổi thành chuỗi ký tự thoát Hexadecimal (mô phỏng dữ liệu byte) và không còn từ khóa Lua.</p>

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
                Mã Hóa Hex Binary
            </button>
        </div>

        <!-- Vùng hiển thị mã đã Obfuscate -->
        <div class="mb-6">
            <label for="output-code" class="block text-lg font-semibold text-gray-700 mb-2">Mã Lua Đã Obfuscate (Gần như Dữ liệu Byte):</label>
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
            showStatus('Đang thực hiện mã hóa Hex Binary (Mô phỏng dữ liệu Byte)...', 'info');

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
                    showStatus('Mã hóa Hex Binary thành công! Mã đã chuyển thành chuỗi byte không thể đọc được.', 'success');
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
                // document.execCommand('copy') is used here for compatibility
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
