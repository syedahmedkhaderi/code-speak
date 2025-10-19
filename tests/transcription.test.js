// tests/transcription.test.js - END-TO-END TESTS
const request = require('supertest');
const app = require('../backend/server');
const Lecture = require('../backend/models/Lecture');
const User = require('../backend/models/User');
const mongoose = require('mongoose');
describe('CodeSpeak API Tests', () => {
    let testUser;
    let authToken;
    let testLecture;
    
    beforeAll(async () => {
        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/codespeak-test');
        }
    });
    
    afterAll(async () => {
        // Cleanup
        await Lecture.deleteMany({});
        await User.deleteMany({});
        await mongoose.connection.close();
    });
    
    beforeEach(async () => {
        // Clear collections
        await Lecture.deleteMany({});
        await User.deleteMany({});
    });
    
    describe('Authentication', () => {
        test('POST /api/auth/register should create new user', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'TestPassword123',
                    confirmPassword: 'TestPassword123'
                })
                .expect(201);
            
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.email).toBe('test@example.com');
        });
        
        test('POST /api/auth/login should return token', async () => {
            // Create user first
            await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'TestPassword123',
                    confirmPassword: 'TestPassword123'
                });
            
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'TestPassword123'
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('token');
            authToken = response.body.token;
        });
        
        test('POST /api/auth/login should reject wrong password', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'TestPassword123',
                    confirmPassword: 'TestPassword123'
                });
            
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'WrongPassword'
                })
                .expect(401);
            
            expect(response.body.error).toBeDefined();
        });
    });
    
    describe('Lectures', () => {
        beforeEach(async () => {
            // Register and login user
            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'TestPassword123',
                    confirmPassword: 'TestPassword123'
                });
            authToken = registerResponse.body.token;
        });
        
        test('POST /api/lectures/start should create lecture', async () => {
            const response = await request(app)
                .post('/api/lectures/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Lecture',
                    subject: 'Algorithms'
                })
                .expect(201);
            
            expect(response.body).toHaveProperty('lectureId');
            testLecture = response.body.lectureId;
        });
        
        test('POST /api/transcription/process should handle code', async () => {
            const lectureResponse = await request(app)
                .post('/api/lectures/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Lecture',
                    subject: 'Algorithms'
                });
            
            const lectureId = lectureResponse.body.lectureId;
            
            const response = await request(app)
                .post('/api/transcription/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lectureId: lectureId,
                    text: 'for i in range ten print i',
                    timestamp: 10
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
        });
        
        test('GET /api/lectures/history should return user lectures', async () => {
            // Create lectures
            await request(app)
                .post('/api/lectures/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Lecture 1',
                    subject: 'Algorithms'
                });
            
            const response = await request(app)
                .get('/api/lectures/history')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(Array.isArray(response.body.lectures)).toBe(true);
            expect(response.body.lectures.length).toBe(1);
        });
    });
    
    describe('Authorization', () => {
        test('Should reject requests without token', async () => {
            const response = await request(app)
                .get('/api/lectures/history')
                .expect(401);
            
            expect(response.body.error).toBeDefined();
        });
        
        test('Should reject requests with invalid token', async () => {
            const response = await request(app)
                .get('/api/lectures/history')
                .set('Authorization', 'Bearer invalid_token')
                .expect(401);
            
            expect(response.body.error).toBeDefined();
        });
    });
});