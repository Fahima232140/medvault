// backend/auth.js (Обновлено для MongoDB/Mongoose)

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("./models/User"); // <-- ИМПОРТ МОДЕЛИ USER
const router = express.Router();
require("dotenv").config();

// Секретный ключ для JWT
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

/* -------- Middleware для проверки JWT -------- */

// Middleware заменен на асинхронный поиск в БД
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access token missing or invalid format" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Находим пользователя в MongoDB
        const user = await User.findOne({ email: decoded.email }); 
        
        if (!user) {
            return res.status(401).json({ message: "User not found (token valid, but user missing)" });
        }
        
        // Прикрепляем данные пользователя к объекту запроса
        req.user = { email: user.email, role: user.role }; 
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

/* -------- Роуты аутентификации -------- */

// 1. Регистрация (Signup)
router.post("/register", async (req, res) => {
    const { name, email, phone, password, role, zkpPublicKey } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
    }

    try {
        // Проверка существования
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({
            email,
            passwordHash,
            name,
            phone,
            role: role || "patient", // Используем роль из запроса (doctor/patient)
            zkpPublicKey,
        });

        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Server error during registration" });
    }
});

// 2. Логин
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // Находим пользователя в MongoDB
        const user = await User.findOne({ email }); 
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Сравниваем хешированный пароль
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Генерация JWT
        const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, {
            expiresIn: "1h",
        });

        res.json({
            message: "Login successful",
            token,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                iin: user.iin,
                zkpPublicKey: user.zkpPublicKey,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login" });
    }
});


module.exports = { router, authMiddleware };