// routes/transcription.js - WITH VALIDATION & FALLBACK
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Lecture = require('../models/Lecture');
const CodeSnippet = require('../models/CodeSnippet');
const { validateTranscription } = require('../utils/validation');
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';


// Rate limiting counter (in production, use Redis)
const requestCounts = {};
const checkRateLimit = (userId, limit = 100, windowMs = 60000) => {
  const key = `${userId}-${Math.floor(Date.now() / windowMs)}`;
  requestCounts[key] = (requestCounts[key] || 0) + 1;
  
  // Clean old entries
  Object.keys(requestCounts).forEach(k => {
    const [, timestamp] = k.split('-');
    if (Math.floor(Date.now() / windowMs) - parseInt(timestamp) > 1) {
      delete requestCounts[k];
    }
  });
  
  return requestCounts[key] <= limit;
};


// 1. Process transcription chunk (called in real-time)
router.post('/process', async (req, res) => {
  try {
    const { lectureId, text, timestamp } = req.body;
    const userId = req.user._id;
    
    // Rate limiting
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 100 requests per minute.' });
    }
    
    // Validation
    const validation = validateTranscription(lectureId, text, timestamp);
    if (!validation.isValid) {
      return res.status(400).json({ errors: validation.errors });
    }
    
    // Check lecture exists and belongs to user
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    if (lecture.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this lecture' });
    }
    
    // Call ML service with fallback
    let mlResponse;
    try {
      mlResponse = await axios.post(`${ML_SERVICE_URL}/detect-code`, {
        text: text
      }, {
        timeout: 5000
      });
    } catch (mlError) {
      console.warn('ML service unavailable, using fallback:', mlError.message);
      // Fallback: treat as regular text if ML service is down
      mlResponse = {
        data: {
          isCode: false,
          correctedText: text,
          language: 'other',
          confidence: 0
        }
      };
    }
    
    const { isCode, correctedText, language, confidence } = mlResponse.data;
    
    // Add to transcription
    lecture.transcription.push({
      timestamp,
      text: correctedText,
      isCode,
      codeLanguage: language,
      confidence
    });
    
    // Create code snippet if high confidence
    if (isCode && confidence > 0.7) {
      const snippet = new CodeSnippet({
        lectureId,
        code: correctedText,
        language,
        timestamp,
        originalTranscript: text,
        confidence
      });
      
      await snippet.save();
      lecture.codeSnippets.push(snippet._id);
    }
    
    await lecture.save();
    
    res.json({
      success: true,
      isCode,
      correctedText,
      language,
      confidence
    });
    
  } catch (error) {
    console.error('Transcription processing error:', error);
    res.status(500).json({ error: 'Failed to process transcription' });
  }
});

// 2. Get live transcription for display
router.get('/live/:lectureId', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const userId = req.user._id;
    
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    if (lecture.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to view this lecture' });
    }
    
    res.json({
      transcription: lecture.transcription.slice(-20)
    });
  } catch (error) {
    console.error('Error fetching live transcription:', error);
    res.status(500).json({ error: 'Failed to fetch transcription' });
  }
});

// 3. Get full transcription with search
router.get('/:lectureId/full', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { search } = req.query;
    const userId = req.user._id;
    
    const lecture = await Lecture.findById(lectureId).populate('codeSnippets');
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    
    if (lecture.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to view this lecture' });
    }
    
    let transcription = lecture.transcription;
    
    if (search) {
      const searchLower = search.toLowerCase();
      transcription = transcription.filter(entry =>
        entry.text.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      lecture: {
        id: lecture._id,
        title: lecture.title,
        duration: lecture.duration,
        startTime: lecture.startTime
      },
      transcription,
      codeSnippets: lecture.codeSnippets
    });
  } catch (error) {
    console.error('Error fetching full transcription:', error);
    res.status(500).json({ error: 'Failed to fetch transcription' });
  }
});

module.exports = router;