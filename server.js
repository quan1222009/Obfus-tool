// Thiết lập Server và Middleware
const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000; 

// Thư viện cần thiết cho Base64 encoding
const Buffer = require('buffer').Buffer;

app.use(express.json({ limit: '5mb' }));
app.use(cors()); 

// --- 1. LOGIC OBFUSCATOR (Backend) ---

// Map từ khóa (Key-Word Mangling)
const KEYWORD_MAP = {
    'local ': '___A01___', 'function ': '___B02___', 'end': '___C03___', 'if ': '___D04___', 'then': '___E05___', 'else': '___F06___', 'elseif ': '___G07___', 'do': '___H08___', 'while ': '___I09___', 'return ': '___J10___', '=': '___K11___', '(': '___L12___', ')': '___M13___', '{': '___N14___', '}': '___O15___', '[': '___P16___', ']': '___Q17___', ':': '___R18___', ';': '___S19___', ',': '___T20___', 'and ': '___U21___', 'or ': '___V22___', 'not ': '___W23___', 'in ': '___X24___', 'for ': '___Y25___', '~=': '___Z26___', '--': '___ZZZ___', 'nil': '___NIL___', 'break': '___BRK___', 'repeat': '___RPT___', 'until': '___UTL___', 'false': '___FAS___', 'true': '___TRS___',
};

// Hàm tiện ích
const randName = (prefix = 'V') => `${prefix}_${Math.random().toString(36).substring(2, 12)}`;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const encodeString = (str) => Array.from(str).map(c => c.charCodeAt(0)).join(',');

/**
 * GENERATE MISLEADING JUNK FUNCTIONS
 * Tạo ra các hàm cục bộ có tên gợi ý nhưng chỉ chứa logic rác phức tạp.
 */
const generateMisleadingFunctions = (count = 4) => {
    let junk = [];
    const deceptiveNames = ['LoadModule', 'ProcessData', 'VerifyChecksum', 'CalculateHash', 'DecryptResource', 'ExecuteTask'];
    
    for (let i = 0; i < count; i++) {
        const funcName = deceptiveNames[i % deceptiveNames.length] + randName('Fn');
        const varA = randName('A');
        const varB = randName('B');
        const varC = randName('C');
        const randLoop = randomInt(5, 10);
        
        // Logic rác phức tạp
        const funcCode = `
            local function ${funcName}(${varA}, ${varB})
                local ${varC} = 0
                for i=1, ${randLoop} do
                    ${varC} = ${varC} + (${varA} * i) / (${varB} or 1)
                    if ${varC} > 100 then ${varC} = ${varC} / 2 end
                end
                if ${varA} > ${randomInt(50, 150)} and ${varB} < ${randomInt(10, 30)} then 
                    return "ERROR: CODE MISMATCH" 
                else 
                    return ${varC} + ${randomInt(1, 5)} 
                end
            end
            local ${randName('INIT')} = ${funcName}(${randomInt(10, 99)}, ${randomInt(1, 10)})
        `;
        junk.push(funcCode);
    }
    return junk.join('');
};

/**
 * GENERATE MASSIVE JUNK TABLE (MEMORY ATTACK)
 * Tạo ra một bảng Lua khổng lồ (vài ngàn mục) đầy các giá trị rác.
 */
const generateMassiveJunkTable = (size = 3000) => {
    const T = randName('MassiveT');
    let entries = [];
    for (let i = 1; i <= size; i++) {
        // Mỗi entry là một phép tính phức tạp để tăng độ khó phân tích
        const v = randomInt(1000, 9999);
        const f1 = randomInt(2, 5);
        const f2 = randomInt(6, 10);
        entries.push(`${i} = math.floor((${v} * ${f1}) / ${f2})`);
    }
    return `local ${T} = {${entries.join(',')}}`;
};

/**
 * GENERATE TIME SINK LOOP (DYNAMIC ATTACK)
 * Tạo vòng lặp tính toán cực lớn để lãng phí thời gian giả lập.
 */
const generateTimeSinkLoop = (iterations = 5000000) => {
    const i = randName('TSi');
    const v = randName('TSv');
    const c = randName('TSC');
    const funcName = randName('TimeKiller');

    // Mẫu vòng lặp: for i=1, 5000000 do v = (v * 1.0001) + 1 end
    return `
        local ${v} = ${randomInt(100, 200)}.0
        local ${c} = 1.0000001
        local function ${funcName}()
            for ${i}=1, ${iterations} do 
                ${v} = (${v} * ${c}) + (${randomInt(1, 10)} / 7.0) 
            end
            return ${v}
        end
        local ${randName('RES')} = ${funcName}()
    `;
};

/**
 * GENERATE DEEP RECURSION JUNK (EMULATOR CRASH/TIME SINK)
 * Tạo hàm đệ quy sâu 300 lần.
 */
const generateDeepRecursion = (depth = 300) => {
    const funcName = randName('DeepRec');
    const depthVar = randName('D');
    const limit = randName('L');
    
    return `
        local ${limit} = ${depth}
        local function ${funcName}(${depthVar})
            if ${depthVar} < ${limit} then
                ${funcName}(${depthVar} + 1)
            end
            local ${randName('J')} = ${depthVar} * 2
            return ${randName('J')}
        end
        local ${randName('RecInit')} = ${funcName}(1)
    `;
};


/**
 * Xử lý Payload Gốc (Name Mangling, Hex, XOR, sau đó Base64)
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
    
    // 3. Mã hóa XOR
    const xorKey = randomInt(1, 255); 
    let xor_payload = '';
    
    for (let i = 0; i < hex_payload.length; i++) {
        const charCode = hex_payload.charCodeAt(i) ^ xorKey;
        xor_payload += charCode.toString(16).padStart(2, '0');
    }
    
    // 4. Mã hóa Base64 cho XOR Payload
    const base64_payload = Buffer.from(xor_payload).toString('base64');

    return { payload: base64_payload, xorKey: xorKey };
};

// --- LAYER 1: Loader với Base64 Decode & Logic phức tạp ---

const generateLayer1Loader = (xor_data) => {
    
    // Tên biến ngẫu nhiên tối thiểu
    const P = randName('P');
    const K = randName('X');
    const DS = randName('D'); 
    const F = randName('F'); // Tên hàm chính: Base64 -> XOR -> Hex Decode
    const T = randName('T'); // Bảng Lookup Core Functions
    
    // Mã hóa các chuỗi quan trọng thành số học
    const encodedStrings = {
        'load': encodeString('load'), 'string': encodeString('string'), 'char': encodeString('char'), 
        'gsub': encodeString('gsub'), 'tonumber': encodeString('tonumber'), 'table': encodeString('table'),
        'concat': encodeString('concat'), '_G': encodeString('_G'), 'byte': encodeString('byte'), 'sub': encodeString('sub'),
        'function': encodeString('function'),
    };
    
    const load_key = `${DS}({${encodedStrings.load}})`

    // 1. String Decoder (Minimal)
    const stringDecoderCode = `
        local ${DS}
        ${DS}=function(arr)
            local g=getfenv()or _G 
            local s=g[g[${DS}({${encodedStrings.string}})]] 
            local c=s[g[${DS}({${encodedStrings.char}})]]
            local t=g[g[${DS}({${encodedStrings.table}})]]
            local con=t[g[${DS}({${encodedStrings.concat}})]]
            local str={}
            for i=1,#arr do str[i]=c(arr[i]) end
            return con(str)
        end
    `.trim();
    
    // 2. Core Lookup Setup (Minimal)
    const coreLookupSetup = `
        local ${T}={}
        local g_ref=getfenv()or _G
        -- Cache hàm load vào local table T
        ${T}[${load_key}]=g_ref[${load_key}]
        
        ${T}[${DS}({${encodedStrings.tonumber}})]=g_ref[${DS}({${encodedStrings.tonumber}})]
        ${T}[${DS}({${encodedStrings.string}})]=g_ref[${DS}({${encodedStrings.string}})]
        local s_ref=${T}[${DS}({${encodedStrings.string}})]
        ${T}[${DS}({${encodedStrings.char}})]=s_ref[${DS}({${encodedStrings.char}})]
        ${T}[${DS}({${encodedStrings.gsub}})]=s_ref[${DS}({${encodedStrings.gsub}})]
        ${T}[${DS}({${encodedStrings.byte}})]=s_ref[${DS}({${encodedStrings.byte}})]
        ${T}[${DS}({${encodedStrings.sub}})]=s_ref[${DS}({${encodedStrings.sub}})]
    `.trim();

    // 3. BASE64 + XOR + HEX DECODER (Logic Phức tạp hơn)
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const base64DecodeCode = `
        local ${F}
        ${F}=function(${P}, ${K})
            local lc=${T}[${DS}({${encodedStrings.char}})]
            local ln=${T}[${DS}({${encodedStrings.tonumber}})]
            local lby=${T}[${DS}({${encodedStrings.byte}})]
            local ls=${T}[${DS}({${encodedStrings.sub}})]

            -- Base64 Decode
            local b64_map = '${base64Chars}'
            local b64_idx = {}
            for i=1, #b64_map do b64_idx[ls(b64_map, i, i)] = i-1 end
            
            local b64_dec = ''
            local i=1
            while i <= #${P} do
                local c1, c2, c3, c4 = b64_idx[ls(${P}, i, i)], b64_idx[ls(${P}, i+1, i+1)], b64_idx[ls(${P}, i+2, i+2)], b64_idx[ls(${P}, i+3, i+3)]
                
                local v1 = (c1*4) + math.floor(c2/16)
                local v2 = ((c2%16)*16) + math.floor(c3/4)
                local v3 = ((c3%4)*64) + c4
                
                b64_dec = b64_dec .. lc(v1) .. (c3~=64 and lc(v2) or '') .. (c4~=64 and lc(v3) or '')
                i=i+4
            end

            -- XOR + HEX Decode (Áp dụng cho b64_dec)
            local rh=''
            local i=1
            while i<=#b64_dec do
                local byte_hex=ls(b64_dec, i, i+1)
                local cc=ln(byte_hex,16)
                local oc=cc~${K} 
                rh=rh..lc(oc)
                i=i+2
            end
            
            -- Final Hex String Decode
            local lg=${T}[${DS}({${encodedStrings.gsub}})]
            local d=lg(rh,'..',function(h)
                local i=ln(h,16)
                return lc(i)
            end)
            return d
        end
    `.trim();
    
    // 4. Execution Block (Tiêm mã rác)
    const payloadDefinition = `local ${P}="${xor_data.payload}"`;
    const keyDefinition = `local ${K}=${xor_data.xorKey}`; 
    
    // Biến kiểm tra type của hàm load đã cache. Nếu bị hook (thay thế) có thể không còn là 'function'
    const loadFunctionTypeCheck = `type(${T}[${load_key}]) ~= ${DS}({${encodedStrings.function}})`
    
    const executionBlock = `
        local l=${T}[${load_key}]
        
        -- BẮT ĐẦU ANTI-HOOK CHECK
        if ${loadFunctionTypeCheck} then
            -- PHÁT HIỆN HOOK HOẶC THAO TÚNG HÀM CƠ BẢN: Kích hoạt tấn công thời gian/bộ nhớ
            
            ${generateMassiveJunkTable(3000)}
            ${generateDeepRecursion(300)}
            ${generateTimeSinkLoop(5000000)}
            
            local ${randName('Trap')} = 1/0 -- Gây lỗi chia cho 0 hoặc Crash
        else 
            -- KHÔNG PHÁT HIỆN HOOK: Thực thi Payload thật
            
            local dc=${F}(${P},${K})
            
            local ${randName('E')}=l(dc)
            if type(${randName('E')})==${DS}({${encodedStrings.function}}) then 
                ${randName('E')}()
            else
                local e=1/0
            end
        end
    `.trim();

    // 5. Kết hợp tất cả thành một khối duy nhất
    const coreBlocks = [
        stringDecoderCode, 
        coreLookupSetup,
        keyDefinition,
        base64DecodeCode,
        generateMisleadingFunctions(4), 
        payloadDefinition,
        executionBlock
    ].join(''); 

    let finalL1Code = coreBlocks;

    // Loại bỏ tất cả khoảng trắng, dấu ngắt dòng thừa
    finalL1Code = finalL1Code
        .replace(/\r?\n|\r/g, '') 
        .replace(/\s+/g, '') 
        .trim();

    return finalL1Code;
};

// --- LAYER 2: Stub (Arithmetic Key Obfuscation) ---

const generateLayer2Stub = (layer1Code) => {
    // 1. Mã hóa Layer 1 code (Hex + XOR lần 2)
    const L2_key_raw = randomInt(1, 255);
    
    // Tạo Phép Toán Số học ẩn Key
    const factor1 = randomInt(5, 10);
    const offset1 = randomInt(10, 50);
    
    const L2_key_obf_value = (L2_key_raw * factor1) + offset1;
    const L2_key_obf_formula = `((${L2_key_obf_value} - ${offset1}) / ${factor1})`;


    let L2_hex_payload = '';
    for (let i = 0; i < layer1Code.length; i++) {
        const charCode = layer1Code.charCodeAt(i) ^ L2_key_raw;
        L2_hex_payload += charCode.toString(16).padStart(2, '0');
    }
    
    // Tên biến ngẫu nhiên tối thiểu
    const P = randName('P'); 
    const K = randName('K'); 
    const D = randName('D'); 
    
    // ASCII codes cho các hàm core
    const generateAsciiLookup = (name) => {
        const charCodes = Array.from(name).map(c => c.charCodeAt(0));
        return charCodes.map(code => `G.string.char(${code})`).join('..');
    };

    const loadAscii = generateAsciiLookup("load");
    const tonumberAscii = generateAsciiLookup("tonumber");
    const stringAscii = generateAsciiLookup("string");
    const charAscii = generateAsciiLookup("char");
    const subAscii = generateAsciiLookup("sub");

    const finalL2Stub = `
        (function()
            local ${P}="${L2_hex_payload}"
            
            -- Key được ẩn bằng phép tính số học (Arithmetic Obfuscation)
            local ${K}=${L2_key_obf_formula}

            local ${D}
            ${D}=function(p, k)
                local G=getfenv()or _G 
                local S=G[${stringAscii}]
                local C=S[${charAscii}]
                local N=G[${tonumberAscii}]
                local L=G[${loadAscii}]
                local SB=S[${subAscii}]
                
                local s=""
                for i=1, #p, 2 do
                    local c=N(SB(p, i, i+1), 16)
                    s=s..C(c~k)
                end
                
                L(s)()
            end

            ${D}(${P}, ${K}) 
        end)()
    `;
    
    // Loại bỏ tất cả khoảng trắng, dấu ngắt dòng để tạo thành một khối duy nhất
    const denseStub = finalL2Stub
        .replace(/\r?\n|\r/g, '') 
        .replace(/\s+/g, '') 
        .trim();

    return denseStub;
};


// Endpoint API chính để thực hiện Obfuscation
app.post('/obfuscate', (req, res) => {
    const { lua_code } = req.body;

    if (!lua_code || typeof lua_code !== 'string') {
        return res.status(400).json({ error: 'Vui lòng cung cấp mã Lua hợp lệ trong trường "lua_code".' });
    }

    try {
        // --- 1. LAYER 1: Mã hóa Payload Gốc (Base64/XOR/Hex)
        const xorDataL1 = processPayload(lua_code);
        
        // --- 2. TẠO LOADER LAYER 1 (Thêm các mã tấn công)
        const layer1Code = generateLayer1Loader(xorDataL1);

        // --- 3. LAYER 2: Stub cuối cùng (Thêm Key Arithmetic Obfuscation)
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
        .btn-primary:hover { box-shadow: 0 0 10px #f87171; transform: translateY(-1px); }
    </style>
</head>
<body class="p-4 md:p-8">

    <div id="app" class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold text-red-400 mb-6 text-center">Menu: Lua Obfuscator Nâng Cao (Direction 5 - Anti-Hooking)</h1>
        <p class="text-gray-400 mb-8 text-center">Đã thêm cơ chế **Anti-Hooking** đơn giản: Nếu hàm \`load\` đã cache bị thay thế, hệ thống sẽ kích hoạt **Time/Memory Sink Attack** và crash, thay vì giải mã code thật.</p>

        <!-- Container cho Input và Output -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <!-- Input Code -->
            <div class="card p-4 rounded-xl">
                <label for="input-code" class="block text-lg font-semibold mb-3 text-blue-400">1. Mã Lua Gốc để Obfuscate</label>
                <textarea id="input-code" rows="15" class="w-full p-3 rounded-lg border border-gray-600 focus:ring-red-500 focus:border-red-500" placeholder="Dán code Lua của bạn vào đây..."></textarea>
            </div>

            <!-- Output Code -->
            <div class="card p-4 rounded-xl">
                <label for="output-code" class="block text-lg font-semibold mb-3 text-red-400">2. Mã Lua Đã Obfuscate</label>
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
            <button onclick="obfuscateCode()" id="obfuscate-btn" class="btn-primary bg-red-500 hover:bg-red-600 text-black font-extrabold py-3 px-8 rounded-full text-xl shadow-lg transition duration-300">
                THỰC HIỆN OBFUSCATE TRÊN SERVER
            </button>
        </div>

        <!-- Thông báo (Message Box) -->
        <div id="message-box" class="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-lg shadow-xl hidden transition-opacity duration-300 z-50"></div>

    </div>

    <script>
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
                const response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lua_code: inputCode }),
                });

                const result = await response.json();

                if (response.ok) {
                    outputArea.value = result.obfuscated_code;
                    statusInfo.textContent = \`Kích thước cuối: \${(result.final_size / 1024).toFixed(2)} KB\`;
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
            document.getElementById('input-code').value = \`-- Mã này đã được nâng cấp lên 3 lớp mã hóa (Base64/XOR/Hex)\nlocal total_score = 0\nfunction add_point(value)\n    total_score = total_score + value\n    if total_score > 1000 then\n        print("Mission Complete!")\n    end\nend\n\nadd_point(500)\`;
        }

    </script>
</body>
</html>
`;

// Đường dẫn chính hiển thị giao diện người dùng
app.get('/', (req, res) => {
    res.send(CLIENT_UI_HTML);
});

// Khởi động Server
app.listen(PORT, () => {
    console.log(`Server Obfuscator đang chạy trên cổng ${PORT}`);
});
