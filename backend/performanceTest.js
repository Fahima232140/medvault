// backend/performanceTest.js

const { encryptAES256, decryptAES256, sha256Hex } = require("./cryptoService");
// Убедитесь, что generateKeys импортируется ЗДЕСЬ
const { createProof, verifyProof, generateKeys } = require("./zkp");
// Предполагаем, что у вас есть функции генерации ключей в zkp.js или вы их перенесете сюда

// Количество итераций для усреднения результатов
const NUM_ITERATIONS = 1000; 

// Имитация медицинских данных (Plaintext)
const dummyData = JSON.stringify({
    Name: "Test Patient",
    Age: 45,
    Medical_Condition: "Hypertension",
    Billing_Amount: 15000.50
});

// Глобальные переменные для ключей (генерируются один раз)
let secretKeyHex;
let publicKeyHex;
let encryptedData;
let dataHash;

async function setup() {
    console.log("--- 🛠️ Setup: Генерация тестовых данных и ключей ZKP ---");
    
    // 1. Генерация ZKP ключей
    const keys = generateKeys(); // Предполагаем, что эта функция существует в zkp.js
    secretKeyHex = keys.secretHex;
    publicKeyHex = keys.publicHex;
    
    // 2. Шифрование данных и получение хеша (имитация загрузки записи)
    encryptedData = encryptAES256(dummyData);
    dataHash = sha256Hex(encryptedData);
    
    console.log(`ZKP Public Key: ${publicKeyHex.slice(0, 10)}...`);
    console.log(`Data Hash (Commitment): ${dataHash.slice(0, 10)}...`);
    console.log("Setup Complete.\n");
}


// -------------------------------------------------------------------
// ТЕСТ 1: Скорость Шифрования / Дешифрования AES-256
// -------------------------------------------------------------------

function testAESPerformance() {
    console.log(`--- 🔬 TEST 1: AES-256 Encryption/Decryption (${NUM_ITERATIONS} ops) ---`);
    
    const startEncrypt = Date.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        encryptAES256(dummyData);
    }
    const endEncrypt = Date.now();
    const avgEncrypt = (endEncrypt - startEncrypt) / NUM_ITERATIONS;

    const startDecrypt = Date.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        decryptAES256(encryptedData);
    }
    const endDecrypt = Date.now();
    const avgDecrypt = (endDecrypt - startDecrypt) / NUM_ITERATIONS;

    console.log(`> Среднее время шифрования: ${avgEncrypt.toFixed(4)} ms`);
    console.log(`> Среднее время дешифрования: ${avgDecrypt.toFixed(4)} ms`);
}


// -------------------------------------------------------------------
// ТЕСТ 2: Скорость ZKP Proof Generation / Verification
// -------------------------------------------------------------------

async function testZKPPerformance() {
    console.log(`\n--- 🔬 TEST 2: ZKP Verification (Critical Path) (${NUM_ITERATIONS} ops) ---`);

    const proofs = [];
    
    // Фаза 1: Генерация доказательств (эту работу делает фронтенд)
    const startProofGen = Date.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        // Доказательство, что мы знаем секрет (secretKeyHex), соответствующий публичному ключу (publicKeyHex), для сообщения (dataHash)
        const proof = await createProof(secretKeyHex, dataHash);
        proofs.push(proof);
    }
    const endProofGen = Date.now();
    const avgProofGen = (endProofGen - startProofGen) / NUM_ITERATIONS;
    
    // Фаза 2: Верификация доказательств (эту работу делает бэкенд - CRITICAL)
    let successfulVerifications = 0;
    const startVerify = Date.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        const result = verifyProof(publicKeyHex, dataHash, proofs[i]);
        if (result) {
            successfulVerifications++;
        }
    }
    const endVerify = Date.now();
    const avgVerify = (endVerify - startVerify) / NUM_ITERATIONS;

    console.log(`> Среднее время генерации Proof (Client): ${avgProofGen.toFixed(4)} ms`);
    console.log(`> Среднее время верификации Proof (Server): ${avgVerify.toFixed(4)} ms`);
    console.log(`> Успешных верификаций: ${successfulVerifications}/${NUM_ITERATIONS}`);
}


// -------------------------------------------------------------------
// ТЕСТ 3: Тестирование отказоустойчивости (Failure Rate)
// -------------------------------------------------------------------

async function testFailureRate() {
    console.log("\n--- 🔬 TEST 3: Testing Failure Resilience ---");
    
    const proof = await createProof(secretKeyHex, dataHash);
    
    // 1. Неверный публичный ключ
    // ИСПРАВЛЕНО: УБРАЛИ ЛИШНИЙ "0x"
    const result1 = verifyProof("DEADBEEF", dataHash, proof); // <-- ИЗМЕНИТЬ ЭТУ СТРОКУ
    console.log(`> Верификация с неверным Public Key: ${result1 ? '❌ FAILED (Should be False)' : '✅ SUCCESS (False)'}`);

    // 2. Искаженный хеш данных (Message)
    const result2 = verifyProof(publicKeyHex, "corrupted_hash_data", proof);
    console.log(`> Верификация с искаженным Data Hash: ${result2 ? '❌ FAILED (Should be False)' : '✅ SUCCESS (False)'}`);
    
    // 3. Искаженное доказательство (s-value)
    const corruptedProof = { r: proof.r, s: "1234567890abcdef" }; 
    const result3 = verifyProof(publicKeyHex, dataHash, corruptedProof);
    console.log(`> Верификация с искаженным Proof (s-value): ${result3 ? '❌ FAILED (Should be False)' : '✅ SUCCESS (False)'}`);
}


// -------------------------------------------------------------------
// ЗАПУСК ВСЕХ ТЕСТОВ
// -------------------------------------------------------------------

async function runTests() {
    await setup();
    
    testAESPerformance();
    
    await testZKPPerformance();
    
    await testFailureRate();
    
    console.log("\n*** ✅ PERFORMANCE TESTING COMPLETE ***");
    console.log("Используйте эти средние значения (особенно ZKP Verification) для Цели 4.");
}

runTests();