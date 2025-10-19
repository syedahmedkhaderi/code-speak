// This is routes/lectures.js - WITH AUTH & ERROR HANDLING
const express = require('express');
const router = express.Router();
const Lecture = require('../models/Lecture');
const CodeSnippet = require('../models/CodeSnippet');
const { validateLecture } = require('../utils/validation');

// 1. Create new lecture session
router.post('/start', async (req, res) => {
    try {
        const { title, subject, instructor } = req.body;
        
        const validation = validateLecture({ title, subject });
        if (!validation.isValid) {
            return res.status(400).json({ errors: validation.errors });
        }

        const lecture = new Lecture({
            title: title.trim(),
            subject,
            instructor: instructor || 'Unknown',
            userId: req.user._id
        });

        await lecture.save();

        res.status(201).json({
            lectureId: lecture._id,
            message: 'Lecture started successfully'
        });
    } catch (error) {
        console.error('Error starting lecture:', error);
        res.status(500).json({ error: 'Failed to start lecture' });
    }
});

// 2. End lecture session
router.post('/end/:lectureId', async (req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.lectureId);
        
        if (!lecture) {
            return res.status(404).json({ error: 'Lecture not found' });
        }

        if (lecture.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to end this lecture' });
        }

        lecture.endTime = new Date();
        lecture.duration = Math.round((lecture.endTime - lecture.startTime) / 1000);
        await lecture.save();

        res.json({
            message: 'Lecture ended successfully',
            lecture: {
                id: lecture._id,
                title: lecture.title,
                duration: lecture.duration
            }
        });
    } catch (error) {
        console.error('Error ending lecture:', error);
        res.status(500).json({ error: 'Failed to end lecture' });
    }
});
// 3. Get all lectures for user (with pagination)
router.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const lectures = await Lecture.find({ userId: req.user._id })
            .sort({ startTime: -1 })
            .skip(skip)
            .limit(limit)
            .select('title subject startTime duration createdAt');

        const total = await Lecture.countDocuments({ userId: req.user._id });

        res.json({
            lectures,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch lecture history' });
    }
});
// 4. Get specific lecture with snippets
router.get('/:lectureId', async (req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.lectureId)
            .populate('codeSnippets');
        
        if (!lecture) {
            return res.status(404).json({ error: 'Lecture not found' });
        }

        if (lecture.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to view this lecture' });
        }

        res.json(lecture);
    } catch (error) {
        console.error('Error fetching lecture:', error);
        res.status(500).json({ error: 'Failed to fetch lecture' });
    }
});
// 5. Search lectures
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const lectures = await Lecture.find({
            $text: { $search: q },
            userId: req.user._id
        }).limit(20);

        res.json(lectures);
    } catch (error) {
        console.error('Error searching lectures:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});
// 6. Delete lecture
router.delete('/:lectureId', async (req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.lectureId);
        
        if (!lecture) {
            return res.status(404).json({ error: 'Lecture not found' });
        }

        if (lecture.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to delete this lecture' });
        }

        // Delete associated snippets
        await CodeSnippet.deleteMany({ lectureId: lecture._id });
        await Lecture.findByIdAndDelete(req.params.lectureId);

        res.json({ message: 'Lecture deleted successfully' });
    } catch (error) {
        console.error('Error deleting lecture:', error);
        res.status(500).json({ error: 'Failed to delete lecture' });
    }
});
module.exports = router;