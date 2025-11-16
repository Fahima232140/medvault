// backend/seed.js

const mongoose = require("mongoose");
require("dotenv").config();
const bcrypt = require("bcryptjs");

// Импорт моделей
const User = require('./models/User');
const Record = require('./models/Record');

// Импорт сервисов (для шифрования и имитации)
const { encryptAES256, sha256Hex } = require("./cryptoService");
const { uploadEncryptedRecord } = require("./firebase"); 
const { storeRecordHashOnChain } = require("./blockchain"); 

const DB_URI = process.env.DB_URI;
const PASSWORD = "123456"; // Единый простой пароль для всех тестовых пользователей

const TEST_USERS = [
    { 
        email: "patient@test.com", 
        name: "Иванов Иван", 
        role: "patient", 
        zkpPublicKey: "0x1234567890abcdef1234567890abcdef" // Моковый ключ 
    },
    { 
        email: "doctor@test.com", 
        name: "Петров Пётр", 
        role: "doctor", 
        zkpPublicKey: "0xdeadbeefdeadbeefdeadbeefdeadbeef" // Моковый ключ доктора 
    }
];

const TEST_RECORDS = [
    { 
        ownerEmail: "patient@test.com", 
        data: "Диагноз: Острый бронхит. Рекомендации: Антибиотики 5 дней, постельный режим." 
    },
    { 
        ownerEmail: "patient@test.com", 
        data: "Диагноз: Общий анализ крови в норме. Следующий осмотр через 3 месяца." 
    }
];

async function seedUsers() {
    console.log("--- 1. Добавление тестовых пользователей ---");
    const salt = await bcrypt.genSalt(10);

    for (const userData of TEST_USERS) {
        const passwordHash = await bcrypt.hash(PASSWORD, salt);
        const user = { ...userData, passwordHash };
        
        try {
            await User.create(user);
            console.log(`✅ User created: ${userData.email}`);
        } catch (error) {
            if (error.code === 11000) { // Код ошибки для 'unique'
                console.log(`⚠️ User already exists: ${userData.email}`);
            } else {
                console.error(`Error creating user ${userData.email}:`, error.message);
            }
        }
    }
}

async function seedRecords() {
    console.log("--- 2. Добавление тестовых записей ---");
    
    for (const rec of TEST_RECORDS) {
        const encrypted = encryptAES256(rec.data);
        const hashHex = sha256Hex(encrypted);
        const recordId = mongoose.Types.ObjectId().toString(); // Генерация ID
        
        try {
            // Имитация загрузки в Firebase
            const storageUrl = await uploadEncryptedRecord(recordId, encrypted);
            
            // Имитация регистрации в Блокчейне
            const blockchainTx = await storeRecordHashOnChain(hashHex);

            const newRecord = new Record({
                recordId,
                ownerEmail: rec.ownerEmail,
                hashHex,
                storageUrl,
                status: "Verified on Chain (Seeded)",
                blockchainTx,
            });
            await newRecord.save();
            console.log(`✅ Record added for ${rec.ownerEmail} (ID: ${recordId.slice(0, 8)})`);

        } catch (error) {
            console.error(`Error adding record for ${rec.ownerEmail}:`, error.message);
        }
    }
}

async function runSeed() {
    console.log("Starting database seeding...");
    
    try {
        await mongoose.connect(DB_URI);
        console.log("MongoDB connected for seeding.");

        // Очистка старых данных (ОПЦИОНАЛЬНО: раскомментируйте, если хотите полностью очистить БД)
        // console.log("Cleaning up old data...");
        // await User.deleteMany({});
        // await Record.deleteMany({});
        // console.log("Cleanup complete.");

        await seedUsers();
        await seedRecords();

    } catch (error) {
        console.error("Fatal Seeding Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Seeding complete. MongoDB disconnected.");
    }
}

runSeed();