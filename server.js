// Import Express
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware để phân tích body JSON từ yêu cầu POST
app.use(express.json());

// --- TIỆN ÍCH VÀ MÃ HÓA ---

// Bộ ký tự đặc biệt tùy chỉnh (Base N Custom)
const SYMBOL_MAP = '!@#$%^&*~|@*#^&'; 

/**
 * Hàm mã hóa dữ liệu thành chuỗi ký tự đặc biệt tùy chỉnh (Base N Custom).
 * Dùng Buffer Base64 làm bước trung gian vì nó hoạt động tốt trên Node.js.
 * @param {string} str Dữ liệu cần mã hóa.
 * @returns {string} Chuỗi ký tự đặc biệt.
 */
function symbolicEncode(str) {
    if (!str || typeof str !== 'string') {
        throw new Error("Input must be a valid string for symbolic encoding.");
    }

    // 1. Chuyển sang Base64
    let base64Str;
    try {
        base64Str = Buffer.from(str, 'utf8').toString('base64');
    } catch (e) {
        throw new Error("Lỗi khi chuyển đổi Base64: " + e.message);
    }
    
    // 2. Mã hóa Base64 thành ký tự đặc biệt (Symbolic Mapping)
    let symbolicStr = "";
    const mapLength = SYMBOL_MAP.length;
    
    for (let i = 0; i < base64Str.length; i++) {
        const charCode = base64Str.charCodeAt(i);
        
        // Đảm bảo charCode là một số hợp lệ
        if (isNaN(charCode)) {
            // Nếu có lỗi, sử dụng một ký tự mặc định
            symbolicStr += SYMBOL_MAP[0];
            continue; 
        }

        // Ánh xạ an toàn: luôn đảm bảo index nằm trong giới hạn của SYMBOL_MAP
        const mappedIndex = charCode % mapLength;
        symbolicStr += SYMBOL_MAP[mappedIndex];
    }
    
    return symbolicStr;
}

/**
 * Hàm tạo ID ngẫu nhiên.
 */
function generateRandomID(prefix) {
    return `_${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// --- LOGIC BẢO VỆ ĐẦU VÀ ĐUÔI (HEADER/FOOTER) ---

function createObfuscatorHeader() {
    const junkVar1 = generateRandomID('J');
    const funcName = generateRandomID('ENVCHECK');
    
    // Tạo Header phức tạp hơn với các phép toán mảng và kiểm tra môi trường
    const headerCode = `
-- KHỐI BẢO VỆ ĐẦU (HEADER): Khởi tạo Anti-Tamper và Junk Arithmetic
local ${junkVar1} = {0xAA, 0xBB, 0xCC}
local ${funcName} = function(idx)
    local sum = 0
    -- Thêm junk logic
    for i=1, #${junkVar1} do sum = sum + ${junkVar1}[i] end
    if sum % 2 ~= 1 then 
        local v = 1 + 1; local w = 2 - 1
    end
    -- Giả lập kiểm tra môi trường
    if getfenv(0).coroutine then 
        -- Mã hóa thông báo lỗi để gây khó khăn cho kẻ tấn công
        error("\\108\\111\\97\\100\\101\\114\\32\\101\\114\\114\\111\\114")
    end
    -- Trả về giá trị ngẫu nhiên
    return math.random(100, 999)
end
${funcName}(1); 
`;
    return headerCode;
}

function createObfuscatorFooter(checksumValue) {
    const footerVar = generateRandomID('CHK');
    // Checksum cũng được mã hóa Symbolic
    const encodedChecksum = symbolicEncode(checksumValue); 
    
    const footerCode = `
-- KHỐI BẢO VỆ ĐUÔI (FOOTER): Kiểm tra tính toàn vẹn
local ${footerVar} = [[${encodedChecksum}]] 
-- Giả lập mã kiểm tra:
-- if __VM_CHECKSUM_FUNC__(LUA_ENV, ${footerVar}) ~= true then error("Kiểm tra toàn vẹn thất bại") end
`;
    return footerCode;
}

// --- LOGIC MÃ HÓA SYMBOLIC CHÍNH ---

/**
 * Hàm chính thực hiện Obfuscation Symbolic.
 * @param {string} luaCode Mã Lua gốc.
 * @returns {string} Mã Lua đã che giấu (chứa Loader và Payload Symbolic).
 */
function symbolicObfuscate(luaCode) {
    // 1. Mã hóa toàn bộ mã Lua thành ký tự đặc biệt
    const encodedPayload = symbolicEncode(luaCode);
    const payloadVar = generateRandomID('PAYLOAD');
    const loaderFunc = generateRandomID('LOADER');
    
    // 2. Xây dựng Lua Loader phức tạp (Giả lập VM)
    const symbolicMapper = SYMBOL_MAP;
    const loaderCode = `
-- Khởi tạo Symbolic Mapper và Base64 Decoder (giả lập)
local __SYMBOLS__ = "${symbolicMapper}"
local function BASE64_DECODE_SIM(str) 
    -- Hàm giải mã Base64 cực kỳ phức tạp được giả lập tại đây.
    return "" 
end

local function ${loaderFunc}(${payloadVar})
    -- Logic giả lập giải mã ngược từ Symbolic sang Base64
    local decoded_b64 = ""
    for i=1, string.len(${payloadVar}) do
        -- Phép toán phức tạp giả lập quá trình giải mã ký tự
        local char = string.sub(${payloadVar}, i, i)
        local mapped_val = string.byte(char) * 0x7F
        decoded_b64 = decoded_b64 .. string.char(mapped_val % 100)
    end
    
    -- Sau đó giải mã Base64 và tải mã
    local raw_code = BASE64_DECODE_SIM(decoded_b64)
    
    -- Trả về một hàm trống (giả lập việc loadcode/dofile)
    return function() 
        -- Mã thực thi gốc đã được giải mã và chạy tại đây.
        print("Mã đã được Symbolic Decoder giải mã và tải.")
    end
end

-- Tải và Thực thi mã
local __EXECUTOR__ = ${loaderFunc}([[\n${encodedPayload}\n]])
__EXECUTOR__()
`;

    // 3. Giả lập Checksum/Hash
    const simpleChecksum = luaCode.length.toString(); 
    
    // 4. Kết hợp tất cả (Header + Loader + Footer)
    let finalCode = "";
    finalCode += createObfuscatorHeader(); // BẢO VỆ ĐẦU
    finalCode += "\n-- Symbolic Decoder và Payload\n";
    finalCode += loaderCode; // LOADER VÀ PAYLOAD ĐƯỢC MÃ HÓA
    finalCode += createObfuscatorFooter(simpleChecksum); // BẢO VỆ ĐUÔI

    return finalCode;
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
        // Log lỗi chi tiết trên server console
        console.error("LỖI OBFUSCATION:", e.message); 
        // Trả về thông báo lỗi chung cho người dùng
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
        }
    </style>
</head>
<body class="p-4 md:p-8">

    <div class="max-w-2xl mx-auto bg-white shadow-2xl rounded-xl p-6 md:p-8">
        <h1 class="text-3xl font-bold text-center text-gray-800 mb-2">Giả Lập Symbolic Obfuscator (Bền hơn)</h1>
        <p class="text-center text-sm text-gray-500 mb-6">Mã nguồn được mã hóa thành các Ký tự Đặc biệt Tùy chỉnh. Phiên bản này đã được tối ưu độ ổn định.</p>

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
                Mã Hóa Symbolic
            </button>
        </div>

        <!-- Vùng hiển thị mã đã Obfuscate -->
        <div class="mb-6">
            <label for="output-code" class="block text-lg font-semibold text-gray-700 mb-2">Mã Lua Đã Symbolic Encoded:</label>
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
            showStatus('Đang gọi server để thực hiện Symbolic Encoding và Bảo vệ ĐẦU/ĐUÔI...', 'info');

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
                    showStatus('Mã hóa Symbolic thành công!', 'success');
                    copyButton.disabled = false;
                } else {
                    // Hiển thị lỗi chi tiết từ server nếu có
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
