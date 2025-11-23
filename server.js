// Import các thư viện cần thiết
const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000; 

// Middleware để xử lý JSON body và cho phép CORS
app.use(express.json({ limit: '5mb' }));
app.use(cors()); 

// --- 1. LOGIC OBFUSCATOR (Phần Backend) ---

// Cấu hình Obfuscator
const KEYWORD_MAP = {
    'local ': '___A01___', 'function ': '___B02___', 'end': '___C03___', 'if ': '___D04___', 'then': '___E05___', 'else': '___F06___', 'elseif ': '___G07___', 'do': '___H08___', 'while ': '___I09___', 'return ': '___J10___', '=': '___K11___', '(': '___L12___', ')': '___M13___', '{': '___N14___', '}': '___O15___', '[': '___P16___', ']': '___Q17___', ':': '___R18___', ';': '___S19___', ',': '___T20___', 'and ': '___U21___', 'or ': '___V22___', 'not ': '___W23___', 'in ': '___X24___', 'for ': '___Y25___', '~=': '___Z26___', '--': '___ZZZ___', 'nil': '___NIL___', 'break': '___BRK___', 'repeat': '___RPT___', 'until': '___UTL___', 'false': '___FAS___', 'true': '___TRS___',
};

// Hàm tiện ích
const randName = (prefix = 'V') => `${prefix}_${Math.random().toString(36).substring(2, 12)}`;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffleArray = (array) => { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } };
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Hàm mã hóa chuỗi thành mảng số học (ví dụ: 'load' -> {108, 111, 97, 100})
const encodeString = (str) => {
    return Array.from(str).map(c => c.charCodeAt(0)).join(',');
};

// Tạo mã rác
const generateGarbageModule = (count = 15) => {
    let garbage = [];
    // ... (logic tạo mã rác giữ nguyên) ...
    const fakeData = randName() + " = \"" + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + "\"";
    garbage.push(`local ${fakeData} -- Dữ liệu rác giả`);
    for (let i = 0; i < count; i++) {
        const funcName = randName('GM');
        const varA = randName('A');
        const varB = randName('B');
        const moduleCode = `
            local function ${funcName}(${varA}, ${varB})
                local ${randName('C')} = 0
                for i = 1, ${randomInt(5, 15)} do
                    ${randName('C')} = ${randName('C')} + (${varA} * i) / (${varB} or 1)
                end
                if ${randName('C')} > ${randomInt(50, 150)} then
                    return ${randName('C')} * 2
                else
                    return ${randName('C')} / 2
                end
            end
            local ${randName('INIT')} = ${funcName}(${randomInt(10, 99)}, ${randomInt(1, 10)})
        `;
        garbage.push(moduleCode.trim());
    }
    shuffleArray(garbage);
    return garbage.join('\n');
};

// Xử lý Payload (Hex Encoding)
const processPayload = (lua_code) => {
    let code = lua_code;
    // ... (logic thay thế từ khóa và loại bỏ comment giữ nguyên) ...
    code = code.replace(/--.*?\n/g, '\n');
    const sortedKeys = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);
    for (const original of sortedKeys) {
        const replacement = KEYWORD_MAP[original];
        if (original.trim().match(/^[a-zA-Z]/)) {
            code = code.replace(new RegExp('\\b' + original.trim() + '\\b', 'g'), replacement.trim());
        } else {
            code = code.split(original).join(replacement);
        }
    }
    let hex_payload = '';
    for (let i = 0; i < code.length; i++) {
        hex_payload += code.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex_payload;
};

// Tạo Stub Loader (Sử dụng Arithmetic String Encoding)
const generateStubLoader = (hex_payload, garbage_code) => {
    
    // Tên biến ngẫu nhiên
    const payloadVar = randName('P');
    const loaderFunc = randName('L');
    const decodeFunc = randName('D');
    const coreFunc = randName('C');
    const runFunc = randName('R');
    
    // 1. Mã hóa các chuỗi quan trọng thành số học
    const encodedStrings = {
        'load': encodeString('load'),
        '_G': encodeString('_G'),
        'string': encodeString('string'),
        'char': encodeString('char'),
        'gsub': encodeString('gsub'),
        'tonumber': encodeString('tonumber'),
    };

    // 2. Hàm giải mã chuỗi từ số học (String Decoder)
    const stringDecoderCode = `
        local ${decodeFunc}
        ${decodeFunc} = function(arr)
            local s = {}
            for i = 1, #arr do
                s[i] = string.char(arr[i])
            end
            return table.concat(s)
        end
    `.trim();

    // 3. Sử dụng String Decoder để tạo Core Function Lookups (Mã hóa chuỗi)
    const coreFunctionLookups = `
        local ${coreFunc} = {}
        ${coreFunc}[${decodeFunc}({${encodedStrings.load}})] = load
        ${coreFunc}[${decodeFunc}({${encodedStrings._G}})] = _G
        ${coreFunc}[${decodeFunc}({${encodedStrings.string}})] = string
        ${coreFunc}[${decodeFunc}({${encodedStrings.char}})] = string.char
        ${coreFunc}[${decodeFunc}({${encodedStrings.gsub}})] = string.gsub
        ${coreFunc}[${decodeFunc}({${encodedStrings.tonumber}})] = tonumber
    `.trim();

    // 4. Định nghĩa hàm giải mã Hex payload
    // Bây giờ, hàm này sử dụng các biến Core Function đã được ẩn danh
    const hexDecodeFunc = `
        local ${loaderFunc}
        ${loaderFunc} = function(${payloadVar})
            local ${randName('TEMP_GSUB')} = ${coreFunc}[${decodeFunc}({${encodedStrings.gsub}})]
            local ${randName('TEMP_TONUM')} = ${coreFunc}[${decodeFunc}({${encodedStrings.tonumber}})]
            local ${randName('TEMP_CHAR')} = ${coreFunc}[${decodeFunc}({${encodedStrings.char}})]

            local ${randName('D')} = ${randName('TEMP_GSUB')}(${payloadVar}, '..', function(h)
                local ${randName('I')} = ${randName('TEMP_TONUM')}(h, 16)
                return ${randName('TEMP_CHAR')}(${randName('I')})
            end)
            return ${randName('D')}
        end
    `.trim();
    
    // 5. Dòng thực thi (Execute)
    const executionLine = `
        -- Bắt đầu quá trình giải mã và thực thi
        local ${randName('LOAD')} = ${coreFunc}[${decodeFunc}({${encodedStrings.load}})]
        local ${runFunc} = ${randName('LOAD')}(${loaderFunc}(${payloadVar}))
        ${runFunc}()
    `.trim();

    // 6. Trộn lẫn mã Stub Loader và Mã Rác
    const garbageBlocks = garbage_code.split('\n').filter(line => line.trim() !== '');
    const payloadDefinition = `local ${payloadVar} = "${hex_payload}"`;
    const structuredBlocks = [];

    // Xáo trộn Dòng/Khối: Chèn rác vào giữa các khối logic
    structuredBlocks.push(stringDecoderCode); // Đặt String Decoder đầu tiên
    structuredBlocks.push(payloadDefinition);
    structuredBlocks.push(...garbageBlocks.slice(0, 3)); 
    structuredBlocks.push(coreFunctionLookups); // Lookups ẩn danh
    structuredBlocks.push(...garbageBlocks.slice(3, 6)); 
    structuredBlocks.push(hexDecodeFunc); // Hex Decoder ẩn danh
    structuredBlocks.push(...garbageBlocks.slice(6, 9)); 
    structuredBlocks.push(executionLine);
    structuredBlocks.push(...garbageBlocks.slice(9)); 

    // Thêm Payload Rác Giả Dạng Nhị Phân/Ký tự Đặc biệt
    const binaryNoise = Array.from({ length: 500 }, () => randomChoice(['\\x01', '\\x02', '\\x03', '0', '1', ' '])).join('');
    const noiseComment = `\n-- Lớp nhiễu giả dạng nhị phân/ký tự Đặc biệt:\n--[[${binaryNoise}]]\n`;
    
    return structuredBlocks.join('\n\n') + noiseComment;
};

// Endpoint API chính để thực hiện Obfuscation
app.post('/obfuscate', (req, res) => {
    const { lua_code } = req.body;

    if (!lua_code || typeof lua_code !== 'string') {
        return res.status(400).json({ error: 'Vui lòng cung cấp mã Lua hợp lệ trong trường "lua_code".' });
    }

    try {
        const garbageCode = generateGarbageModule(15);
        const hexPayload = processPayload(lua_code);
        const obfuscatedCode = generateStubLoader(hexPayload, garbageCode);
        
        res.json({ 
            success: true, 
            obfuscated_code: obfuscatedCode,
            final_size: Buffer.byteLength(obfuscatedCode, 'utf8')
        });

    } catch (error) {
        console.error("Lỗi Obfuscation:", error);
        res.status(500).json({ error: 'Lỗi máy chủ trong quá trình Obfuscation.' });
    }
});

// --- 2. GIAO DIỆN NGƯỜI DÙNG (Menu HTML/JS) ---

const CLIENT_UI_HTML = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Menu: Full-Stack Lua Obfuscator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0d1117; color: #c9d1d9; }
        .card { background-color: #161b22; border: 1px solid #30363d; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); }
        textarea { background-color: #010409; color: #38bdf8; font-family: 'Consolas', 'Courier New', monospace; resize: none; }
        .btn-primary { transition: all 0.2s; }
        .btn-primary:hover { box-shadow: 0 0 10px #4ade80; transform: translateY(-1px); }
    </style>
</head>
<body class="p-4 md:p-8">

    <div id="app" class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold text-green-400 mb-6 text-center">Menu: Lua Obfuscator Toàn Diện</h1>
        <p class="text-gray-400 mb-8 text-center">Giao diện này gọi API Obfuscate ngay trên máy chủ này.</p>

        <!-- Container cho Input và Output -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <!-- Input Code -->
            <div class="card p-4 rounded-xl">
                <label for="input-code" class="block text-lg font-semibold mb-3 text-blue-400">1. Mã Lua Gốc để Obfuscate</label>
                <textarea id="input-code" rows="15" class="w-full p-3 rounded-lg border border-gray-600 focus:ring-green-500 focus:border-green-500" placeholder="Dán code Lua của bạn vào đây..."></textarea>
            </div>

            <!-- Output Code -->
            <div class="card p-4 rounded-xl">
                <label for="output-code" class="block text-lg font-semibold mb-3 text-green-400">2. Mã Lua Đã Obfuscate</label>
                <textarea id="output-code" rows="15" readonly class="w-full p-3 rounded-lg border border-gray-600 cursor-text" placeholder="Mã đã được mã hóa sẽ xuất hiện ở đây..."></textarea>
                <div class="flex justify-between mt-4 space-x-3">
                    <button onclick="clearCodes()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-150">Xóa</button>
                    <span id="status-info" class="text-sm text-gray-400 self-center"></span>
                    <button onclick="copyOutput()" id="copy-btn" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-150">Sao chép</button>
                </div>
            </div>
        </div>

        <!-- Nút Obfuscate -->
        <div class="mt-8 flex justify-center">
            <button onclick="obfuscateCode()" id="obfuscate-btn" class="btn-primary bg-green-500 hover:bg-green-600 text-black font-extrabold py-3 px-8 rounded-full text-xl shadow-lg transition duration-300">
                THỰC HIỆN OBFUSCATE TRÊN SERVER
            </button>
        </div>

        <!-- Thông báo (Message Box) -->
        <div id="message-box" class="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-lg shadow-xl hidden transition-opacity duration-300 z-50"></div>

    </div>

    <script>
        // CLIENT-SIDE JS: Gọi API ngay trên domain này
        const API_ENDPOINT = '/obfuscate';
        
        const outputArea = document.getElementById('output-code');
        const obfuscateBtn = document.getElementById('obfuscate-btn');
        const statusInfo = document.getElementById('status-info');
        
        const showMessage = (text, isError = false) => {
            const msgBox = document.getElementById('message-box');
            msgBox.textContent = text;
            msgBox.className = \`fixed bottom-4 right-4 p-3 \${isError ? 'bg-red-600' : 'bg-blue-600'} text-white rounded-lg shadow-xl opacity-100 transition-opacity duration-300 z-50\`;
            msgBox.style.display = 'block';

            setTimeout(() => {
                msgBox.style.opacity = '0';
                setTimeout(() => msgBox.style.display = 'none', 300);
            }, 3000);
        };

        const obfuscateCode = async () => {
            const inputCode = document.getElementById('input-code').value;
            
            if (!inputCode.trim()) {
                showMessage("Vui lòng dán Mã Lua Gốc vào ô nhập liệu.", true);
                return;
            }

            obfuscateBtn.disabled = true;
            obfuscateBtn.textContent = "Đang xử lý trên Server...";
            outputArea.value = "Đang chờ phản hồi...";
            statusInfo.textContent = "";

            try {
                // Fetch call sử dụng đường dẫn tương đối, vì client và server cùng domain
                const response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lua_code: inputCode }),
                });

                const result = await response.json();

                if (response.ok) {
                    outputArea.value = result.obfuscated_code;
                    statusInfo.textContent = \`Kích thước cuối: \${Math.round(result.final_size / 1024)} KB\`;
                    showMessage("Obfuscation thành công!", false);
                } else {
                    outputArea.value = \`LỖI API (\${response.status}): \${result.error || 'Lỗi không xác định.'}\`;
                    showMessage(\`Lỗi Obfuscation: \${result.error || 'Server phản hồi lỗi.'}\`, true);
                }

            } catch (error) {
                console.error("Lỗi kết nối:", error);
                outputArea.value = \`LỖI KẾT NỐI: Không thể gọi API. Kiểm tra console.\`;
                showMessage("Lỗi mạng. Đảm bảo server đang chạy.", true);
            } finally {
                obfuscateBtn.disabled = false;
                obfuscateBtn.textContent = "THỰC HIỆN OBFUSCATE TRÊN SERVER";
            }
        };

        const copyOutput = () => {
            if (!outputArea.value) {
                showMessage("Không có mã để sao chép.", true);
                return;
            }
            outputArea.select();
            document.execCommand('copy');
            showMessage("Đã sao chép mã Obfuscate!", false);
        };

        const clearCodes = () => {
            document.getElementById('input-code').value = '';
            outputArea.value = '';
            statusInfo.textContent = "";
            showMessage("Đã xóa nội dung thành công.", false);
        };

        window.onload = () => {
            document.getElementById('input-code').value = \`-- Đây là mã Lua Gốc của bạn.\nlocal health = 100\nfunction update_status(damage)\n    health = health - damage\n    if health <= 0 then\n        print("Game Over")\n    end\n    return health\nend\n\nupdate_status(20)\`;
        }

    </script>
</body>
</html>
`;

// --- 3. ĐỊNH TUYẾN EXPRESS ---

// Định tuyến để phục vụ giao diện (Menu)
app.get('/', (req, res) => {
    res.send(CLIENT_UI_HTML);
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server Full-Stack đang chạy tại http://localhost:${PORT}`);
    console.log(`Endpoint Obfuscation: POST /obfuscate`);
});
