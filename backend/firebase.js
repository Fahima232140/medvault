// backend/firebase.js (Обновленная ЗАГЛУШКА)

console.log("--- ⚠️ ИСПОЛЬЗУЕТСЯ ЗАГЛУШКА FIREBASE. Данные не сохраняются персистентно. ---");

// Временное хранилище в памяти для имитации Firebase
const dummyStorage = new Map(); 

async function uploadEncryptedRecord(recordId, encryptedData) {
    // ... (код загрузки)
    return new Promise(resolve => {
        setTimeout(() => {
            dummyStorage.set(recordId, encryptedData); // <-- Сохраняем здесь
            const storageUrl = `http://dummy.storage/records/${recordId}.enc`;
            resolve(storageUrl);
        }, 50); 
    });
}

/**
 * Имитирует загрузку зашифрованного файла из хранилища.
 * @param {string} recordId
 */
async function downloadEncryptedRecord(recordId) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const encrypted = dummyStorage.get(recordId);
            if (encrypted) {
                resolve(encrypted); // Возвращаем зашифрованные данные
            } else {
                reject(new Error("File not found in dummy storage"));
            }
        }, 50);
    });
}

module.exports = { uploadEncryptedRecord, downloadEncryptedRecord }; // <-- ЭКСПОРТ