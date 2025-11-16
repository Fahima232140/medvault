// backend/blockchain.js (ЧИСТАЯ ЗАГЛУШКА)

const { sha256Hex } = require("./cryptoService");

/**
 * Имитирует отправку хеша зашифрованной записи в блокчейн.
 * @param {string} hashHex Хеш зашифрованных данных
 * @returns {Promise<string>} Имитированный ID транзакции блокчейна
 */
async function storeRecordHashOnChain(hashHex) {
    return new Promise(resolve => {
        // Имитация асинхронной записи в блокчейн
        setTimeout(() => {
            // Генерируем уникальный хеш, который выглядит как TxID
            const txId = sha256Hex(`TX-${Date.now()}-${hashHex}`).slice(0, 64);
            console.log(`[Blockchain Stub] Stored hash ${hashHex.slice(0, 10)}... TxID: ${txId.slice(0, 10)}...`);
            resolve(txId);
        }, 50); 
    });
}

// Функции approveDoctor и hasAccess также имитируем, чтобы не вызывать ошибку.
async function approveDoctor(hashHex, doctorAddress) {
    console.log(`[Blockchain Stub] Doctor approval imitated for hash ${hashHex.slice(0, 10)}...`);
    return `MOCK_TX_${Date.now()}`;
}

async function hasAccess(hashHex, userAddress) {
    // Для простоты имитации, всегда возвращаем true
    return true; 
}


module.exports = { storeRecordHashOnChain, approveDoctor, hasAccess };