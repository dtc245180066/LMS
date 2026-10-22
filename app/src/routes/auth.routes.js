const express = require('express');
const authRouter = express.Router();
const authController = require('../controllers/authController');

// 1. Đăng nhập
authRouter.get('/login', authController.renderLogin);    // Xem form đăng nhập
authRouter.post('/login', authController.login);         // Bấm nút Đăng nhập

// 2. Đăng ký
authRouter.get('/register', authController.renderRegister); // Xem form đăng ký
authRouter.post('/register', authController.register);      // Bấm nút Đăng ký

// 3. Đăng xuất
authRouter.get('/logout', authController.logout);

module.exports = authRouter;