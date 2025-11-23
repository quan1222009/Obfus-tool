// Import Express framework
const express = require('express');
const app = express();
// Render sẽ tự động gán PORT cho bạn qua biến môi trường
const PORT = process.env.PORT || 3000; 

// Middleware để xử lý JSON body
app.use(express.json({ limit: '5mb' }));

// Cho phép CORS (quan trọng nếu bạn muốn gọi API từ một trang web khác)
const cors = require('cors');
app.use(cors()); 

// --- Cấu hình Obfuscator ---
const KEYWORD_MAP = {
    'local ': '___A01___', 'function ': '___B02___', 'end': '___C03___', 'if ': '___D04___', 'then': '___E05___', 'else': '___F06___', 'elseif ': '___G07___', 'do': '___H08___', 'while ': '___I09___', 'return ': '___J10___', '=': '___K11___', '(': '___L12___', ')': '___M13___', '{': '___N14___', '}': '___O15___', '[': '___P16___', ']': '___Q17___', ':': '___R18___', ';': '___S19___', ',': '___T20___', 'and ': '___U21___', 'or ': '___V22___', 'not ': '___W23___', 'in ': '___X24___', 'for ': '___Y25___', '~=': '___Z26___', '--': '___ZZZ___', 'nil': '___NIL___', 'break': '___BRK___', 'repeat': '___RPT___', 'until': '___UTL___', 'false': '___FAS___', 'true': '___TRS___',
};

const CORE_FUNCTIONS = {
    'string.gsub': 'STR_GSUB', 'string.char': 'STR_CHAR', 'tonumber': 'TO_NUM', 'load': 'LOAD_FUNC', '_G': '_G_TABLE',
};

// --- Hàm tiện ích ---

const randName = (prefix = 'V') => {
    return `${prefix}_${Math.random().toString(36).substring(2, 12)}`;
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ----------------------------------------------------------------------
// 1. Chèn Mã Rác và Payload Giả
// ----------------------------------------------------------------------

const generateGarbageModule = (count = 15) => {
    let garbage = [];
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

// ----------------------------------------------------------------------
// 2. Xử lý Payload (Symbolic and Hex Encoding)
// ----------------------------------------------------------------------

const processPayload = (lua_code) => {
    let code = lua_code;
    
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

// ----------------------------------------------------------------------
// 3. Tạo Stub Loader (Loader Generation and Structural Obfuscation)
// ----------------------------------------------------------------------

const generateStubLoader = (hex_payload, garbage_code) => {
    
    const payloadVar = randName('P');
    const loaderFunc = randName('L');
    const decodedVar = randName('D');
    const indexVar = randName('I');
    const finalLoadVar = randName('F');
    
    const randomFuncs = {};
    for (const key in CORE_FUNCTIONS) {
        randomFuncs[CORE_FUNCTIONS[key]] = randName('F');
    }
    
    // --- 1. Khai báo các hàm lõi (Lookups) ---
    const coreFunctionLookups = `
        local ${randomFuncs['_G_TABLE']} = _G
        local ${randomFuncs['STR_GSUB']} = ${randomFuncs['_G_TABLE']}['string']['gsub']
        local ${randomFuncs['STR_CHAR']} = ${randomFuncs['_G_TABLE']}['string']['char']
        local ${randomFuncs['TO_NUM']} = ${randomFuncs['_G_TABLE']}['tonumber']
        local ${randomFuncs['LOAD_FUNC']} = ${randomFuncs['_G_TABLE']}['load']
    `.trim();

    // --- 2. Định nghĩa hàm giải mã ---
    const decodeFuncCode = `
        local ${loaderFunc}
        ${loaderFunc} = function(${payloadVar})
            local ${decodedVar} = ${randomFuncs['STR_GSUB']}(${payloadVar}, '..', function(h)
                local ${indexVar} = ${randomFuncs['TO_NUM']}(h, 16)
                return ${randomFuncs['STR_CHAR']}(${indexVar})
            end)
            return ${decodedVar}
        end
    `.trim();
    
    // --- 3. Dòng thực thi ---
    const executionLine = `
        -- Bắt đầu quá trình giải mã và thực thi
        local ${finalLoadVar} = ${randomFuncs['LOAD_FUNC']}(${loaderFunc}(${payloadVar}))
        ${finalLoadVar}()
    `.trim();

    // --- 4. Trộn lẫn mã Stub Loader và Mã Rác (Structural Obfuscation) ---
    const garbageBlocks = garbage_code.split('\n').filter(line => line.trim() !== '');
    const payloadDefinition = `local ${payloadVar} = "${hex_payload}"`;
    
    const structuredBlocks = [];

    // Xáo trộn Dòng/Khối: Chèn rác vào giữa các khối logic
    structuredBlocks.push(payloadDefinition);
    structuredBlocks.push(...garbageBlocks.slice(0, 3)); 
    
    structuredBlocks.push(coreFunctionLookups);
    structuredBlocks.push(...garbageBlocks.slice(3, 6)); 

    structuredBlocks.push(decodeFuncCode);
    structuredBlocks.push(...garbageBlocks.slice(6, 9)); 

    structuredBlocks.push(executionLine);
    structuredBlocks.push(...garbageBlocks.slice(9)); 

    // 5. Thêm Payload Rác Giả Dạng Nhị Phân/Ký tự Đặc biệt
    const binaryNoise = Array.from({ length: 500 }, () => randomChoice(['\\x01', '\\x02', '\\x03', '0', '1', ' '])).join('');
    const noiseComment = `\n-- Lớp nhiễu giả dạng nhị phân/ký tự đặc biệt:\n--[[${binaryNoise}]]\n`;
    
    return structuredBlocks.join('\n\n') + noiseComment;
};

// ----------------------------------------------------------------------
// Định nghĩa API Endpoint
// ----------------------------------------------------------------------

// Endpoint chính để thực hiện Obfuscation
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
            payload_size: hexPayload.length,
            final_size: Buffer.byteLength(obfuscatedCode, 'utf8')
        });

    } catch (error) {
        console.error("Lỗi Obfuscation:", error);
        res.status(500).json({ error: 'Lỗi máy chủ trong quá trình Obfuscation.' });
    }
});

// Endpoint đơn giản để kiểm tra server
app.get('/', (req, res) => {
    res.send('Lua Obfuscator API đang hoạt động. Sử dụng POST /obfuscate để gửi mã.');
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
