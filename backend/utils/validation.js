// utils/validation.js
const validateTranscription = (lectureId, text, timestamp) => {
    const errors = [];
    
    if (!lectureId || !lectureId.match(/^[0-9a-fA-F]{24}$/)) {
        errors.push('Invalid lecture ID');
    }
    
    if (!text || typeof text !== 'string') {
        errors.push('Text is required and must be a string');
    }
    
    if (text.length > 5000) {
        errors.push('Text exceeds maximum length of 5000 characters');
    }
    
    if (typeof timestamp !== 'number' || timestamp < 0) {
        errors.push('Timestamp must be a non-negative number');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};
const validateLecture = (lecture) => {
    const errors = [];
    
    if (!lecture.title || lecture.title.trim().length === 0) {
        errors.push('Title is required');
    }

    if (lecture.title.length > 200) {
        errors.push('Title exceeds maximum length of 200 characters');
    }

    const validSubjects = ['Data Structures', 'Algorithms', 'Web Dev', 'Machine Learning', 'Other'];
    if (!validSubjects.includes(lecture.subject)) {
        errors.push('Invalid subject');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};
module.exports = {
    validateTranscription,
    validateLecture
};