// Import các thư viện cần thiết
const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000; 

// Middleware để xử lý JSON body và cho phép CORS
app.use(express.json({ limit: '5mb' }));
app.use(cors()); 

// --- 1. LOGIC OBFUSCATOR (Phần Backend) ---

// Cấu hình Obfuscator (giữ nguyên logic từ khóa)
const KEYWORD_MAP = {
    'local ': '___A01___', 'function ': '___B02___', 'end': '___C03___', 'if ': '___D04___', 'then': '___E05___', 'else': '___F06___', 'elseif ': '___G07___', 'do': '___H08___', 'while ': '___I09___', 'return ': '___J10___', '=': '___K11___', '(': '___L12___', ')': '___M13___', '{': '___N14___', '}': '___O15___', '[': '___P16___', ']': '___Q17___', ':': '___R18___', ';': '___S19___', ',': '___T20___', 'and ': '___U21___', 'or ': '___V22___', 'not ': '___W23___', 'in ': '___X24___', 'for ': '___Y25___', '~=': '___Z26___', '--': '___ZZZ___', 'nil': '___NIL___', 'break': '___BRK___', 'repeat': '___RPT___', 'until': '___UTL___', 'false': '___FAS___', 'true': '___TRS___',
};

// Hàm tiện ích
const randName = (prefix = 'V') => `${prefix}_${Math.random().toString(36).substring(2, 12)}`;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffleArray = (array) => { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } };

// Hàm mã hóa chuỗi thành mảng số học (ví dụ: 'load' -> {108, 111, 97, 100})
const encodeString = (str) => Array.from(str).map(c => c.charCodeAt(0)).join(',');

// Tạo mã rác
const generateGarbageModule = (count = 15) => {
    let garbage = [];
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

/**
 * Xử lý Payload (Hex + XOR)
 * @param {string} lua_code - Mã Lua cần mã hóa
 * @returns {{ payload: string, key: number }}
 */
const processPayload = (lua_code) => {
    let code = lua_code;
    
    // 1. Mã hóa từ khóa và loại bỏ comment
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
    
    // 2. Mã hóa Hex
    let hex_payload = '';
    for (let i = 0; i < code.length; i++) {
        hex_payload += code.charCodeAt(i).toString(16).padStart(2, '0');
    }
    
    // 3. Mã hóa XOR bằng Khóa ngẫu nhiên (1-255)
    const xorKey = randomInt(1, 255); 
    let xor_payload = '';
    
    for (let i = 0; i < hex_payload.length; i++) {
        const charCode = hex_payload.charCodeAt(i) ^ xorKey;
        xor_payload += charCode.toString(16).padStart(2, '0');
    }
    
    return { payload: xor_payload, key: xorKey };
};

/**
 * TẠO LAYER 1 LOADER: Loader phức tạp, ẩn các hàm core qua _G/Arithmetic String Lookup
 */
const generateLayer1Loader = (xor_data, garbage_code) => {
    
    // Tên biến ngẫu nhiên
    const payloadVar = randName('P');
    const xorKeyVar = randName('X');
    const decodeStringFunc = randName('DS'); // String Decoder
    const xorHexDecodeFunc = randName('XD'); // Hex/XOR Decoder
    const lookupTable = randName('LT'); // Bảng Lookup Core Functions
    const predicateVar = randName('PD'); // Biến cho Control Flow
    const runFunc = randName('R');
    
    // 1. Mã hóa các chuỗi quan trọng thành số học
    const encodedStrings = {
        'load': encodeString('load'), 'string': encodeString('string'), 'char': encodeString('char'), 
        'gsub': encodeString('gsub'), 'tonumber': encodeString('tonumber'), 'table': encodeString('table'),
        'concat': encodeString('concat'), '_G': encodeString('_G'), 
    };

    // 2. Hàm giải mã chuỗi từ số học (String Decoder)
    const stringDecoderCode = `
        local ${decodeStringFunc}
        ${decodeStringFunc} = function(arr)
            local ${randName('G')} = getfenv() or _G -- Lấy môi trường global
            local ${randName('S')} = ${randName('G')}[${decodeStringFunc}({${encodedStrings.string}})]
            local ${randName('C')} = ${randName('S')}[${decodeStringFunc}({${encodedStrings.char}})]
            local ${randName('T')} = ${randName('G')}[${decodeStringFunc}({${encodedStrings.table}})]
            local ${randName('CONCAT')} = ${randName('T')}[${decodeStringFunc}({${encodedStrings.concat}})]

            local s = {}
            for i = 1, #arr do
                s[i] = ${randName('C')}(arr[i])
            end
            return ${randName('CONCAT')}(s)
        end
    `.trim();
    
    // 3. Xây dựng Bảng Lookup Core Functions (Hàm phải được lấy qua tra cứu)
    const coreLookupSetup = `
        local ${lookupTable} = {}
        local ${randName('G_REF')} = getfenv() or _G
        
        -- Chỉ sử dụng tên biến ngẫu nhiên và Lookup Table
        ${lookupTable}[${decodeStringFunc}({${encodedStrings.load}})] = ${randName('G_REF')}[${decodeStringFunc}({${encodedStrings.load}})]
        ${lookupTable}[${decodeStringFunc}({${encodedStrings.tonumber}})] = ${randName('G_REF')}[${decodeStringFunc}({${encodedStrings.tonumber}})]
        ${lookupTable}[${decodeStringFunc}({${encodedStrings.string}})] = ${randName('G_REF')}[${decodeStringFunc}({${encodedStrings.string}})]
        
        -- Lưu trữ các hàm con cần thiết
        local ${randName('S_REF')} = ${lookupTable}[${decodeStringFunc}({${encodedStrings.string}})]
        ${lookupTable}[${decodeStringFunc}({${encodedStrings.char}})] = ${randName('S_REF')}[${decodeStringFunc}({${encodedStrings.char}})]
        ${lookupTable}[${decodeStringFunc}({${encodedStrings.gsub}})] = ${randName('S_REF')}[${decodeStringFunc}({${encodedStrings.gsub}})]
    `.trim();

    // 4. Hàm giải mã XOR và Hex
    const xorHexDecodeFunc = `
        local ${xorHexDecodeFunc}
        ${xorHexDecodeFunc} = function(${payloadVar}, ${xorKeyVar})
            local raw_hex = ''
            
            -- Lấy các hàm qua Lookup Table
            local ${randName('LC')} = ${lookupTable}[${decodeStringFunc}({${encodedStrings.char}})]
            local ${randName('LN')} = ${lookupTable}[${decodeStringFunc}({${encodedStrings.tonumber}})]
            
            local i = 1
            while i <= #${payloadVar} do
                local byte_hex = ${payloadVar}:sub(i, i+1)
                local char_code = ${randName('LN')}(byte_hex, 16)
                local original_char_code = char_code ~ ${xorKeyVar} 
                raw_hex = raw_hex .. ${randName('LC')}(original_char_code)
                i = i + 2
            end
            
            -- Giải mã Hex thành Mã Lua
            local ${randName('LG')} = ${lookupTable}[${decodeStringFunc}({${encodedStrings.gsub}})]
            
            local ${randName('D')} = ${randName('LG')}(raw_hex, '..', function(h)
                local ${randName('I')} = ${randName('LN')}(h, 16)
                return ${randName('LC')}(${randName('I')})
            end)
            return ${randName('D')}
        end
    `.trim();
    
    // 5. Khai báo biến & Control Flow Obfuscation
    const payloadDefinition = `local ${payloadVar} = "${xor_data.payload}"`;
    const keyDefinition = `local ${xorKeyVar} = ${xor_data.key}`; 
    const predicateCalculation = `local ${predicateVar} = (${xorKeyVar} * ${randomInt(10, 50)}) % ${xorKeyVar} == 0`; 
    
    // 6. Dòng Thực thi
    const executionBlock = `
        ${predicateCalculation}
        if ${predicateVar} and ${randName('G')} ~= nil then -- Luôn True + Điều kiện giả
            local ${randName('LOAD')} = ${lookupTable}[${decodeStringFunc}({${encodedStrings.load}})]
            
            local ${randName('DECRYPTED_CODE')} = ${xorHexDecodeFunc}(${payloadVar}, ${xorKeyVar})
            local ${runFunc} = ${randName('LOAD')}(${randName('DECRYPTED_CODE')})
            
            if type(${runFunc}) == 'function' then 
                ${runFunc}()
            else
                local ${randName('ERROR')} = 1/0
            end
        else
            -- Luồng giả mạo, chỉ chứa mã rác
            local ${randName('FAKE_EXEC')} = ${randName('FAKE_EXEC')} or nil
        end
    `.trim();

    // 7. Trộn lẫn (Layer 1)
    const garbageBlocks = garbage_code.split('\n').filter(line => line.trim() !== '');
    const structuredBlocks = [];

    structuredBlocks.push(stringDecoderCode); 
    structuredBlocks.push(coreLookupSetup);
    structuredBlocks.push(keyDefinition);
    structuredBlocks.push(...garbageBlocks.slice(0, 4)); 
    structuredBlocks.push(xorHexDecodeFunc); 
    structuredBlocks.push(payloadDefinition);
    structuredBlocks.push(...garbageBlocks.slice(4, 8)); 
    structuredBlocks.push(executionBlock);
    structuredBlocks.push(...garbageBlocks.slice(8)); 

    return structuredBlocks.join('\n\n');
};


/**
 * TẠO LAYER 2 STUB (Lớp ngoài cùng, đơn giản nhất để che giấu Layer 1 phức tạp)
 * @param {string} layer1Code - Toàn bộ mã Lua Layer 1
 * @returns {string} Mã Lua cuối cùng
 */
const generateLayer2Stub = (layer1Code) => {
    // 1. Mã hóa Layer 1 code (Hex + XOR lần 2)
    const L2_key = randomInt(1, 255);
    let L2_hex_payload = '';
    for (let i = 0; i < layer1Code.length; i++) {
        const charCode = layer1Code.charCodeAt(i) ^ L2_key;
        L2_hex_payload += charCode.toString(16).padStart(2, '0');
    }
    
    // 2. Tạo stub giải mã L2 (Cực kỳ đơn giản)
    const payloadVar = randName('P');
    const keyVar = randName('K');
    const decodeFunc = randName('D');

    const L2_stub = `
        -- Lớp Obfuscation Cuối Cùng (L2 Stub)
        local ${payloadVar} = "${L2_hex_payload}"
        local ${keyVar} = ${L2_key}

        local function ${decodeFunc}(p, k)
            local s = ''
            local ton = tonumber
            local chr = string.char
            for i = 1, #p, 2 do
                local c = ton(p:sub(i, i+1), 16)
                s = s .. chr(c ~ k)
            end
            return s
        end

        local ${randName('L')} = load
        ${randName('L')}(${decodeFunc}(${payloadVar}, ${keyVar}))() -- Giải mã L2 và chạy L1
    `;
    return L2_stub.trim();
};


// Endpoint API chính để thực hiện Obfuscation
app.post('/obfuscate', (req, res) => {
    const { lua_code } = req.body;

    if (!lua_code || typeof lua_code !== 'string') {
        return res.status(400).json({ error: 'Vui lòng cung cấp mã Lua hợp lệ trong trường "lua_code".' });
    }

    try {
        // --- 1. LAYER 1: Mã hóa Payload Gốc (Name Mangling, Hex, XOR)
        const xorDataL1 = processPayload(lua_code);
        const garbageCodeL1 = generateGarbageModule(15);
        
        // --- 2. TẠO LOADER LAYER 1 (Phức tạp, ẩn qua Lookup Table)
        const layer1Code = generateLayer1Loader(xorDataL1, garbageCodeL1);

        // --- 3. LAYER 2: Mã hóa Toàn bộ Layer 1 thành một chuỗi
        const finalObfuscatedCode = generateLayer2Stub(layer1Code);
        
        res.json({ 
            success: true, 
            obfuscated_code: finalObfuscatedCode,
            final_size: Buffer.byteLength(finalObfuscatedCode, 'utf8')
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
        <p class="text-gray-400 mb-8 text-center">Đã áp dụng mã hóa 2 lớp (Double Layer XOR) và Metatable Lookup để ẩn các hàm core.</p>

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
`;eof

### Tóm tắt thay đổi:

1.  **Lớp 2 (Stub Ngoài):** Mã Lua cuối cùng chỉ là một hàm giải mã XOR cực kỳ đơn giản (`decodeFunc`) và một lệnh gọi `load(...)()`. Hàm này không chứa logic phức tạp hay mã rác.
2.  **Lớp 1 (Mã hóa):** Toàn bộ Loader phức tạp, các hàm rác, Metatable Lookup, và Control Flow Obfuscation đã bị Mã hóa hoàn toàn thành một chuỗi Hex/XOR lớn trong Lớp 2.
3.  **Lớp 1 (Metatable Lookup):** Bây giờ, các hàm core như `string.char` không được gọi trực tiếp. Thay vào đó, chúng được tìm trong môi trường toàn cục (`getfenv() or _G`) bằng tên đã được mã hóa số học, và được lưu vào một bảng lookup (`LT`) để truy cập sau này (`LT[key]`). Điều này ẩn hoàn toàn mục đích của các hàm trong Layer 1.
