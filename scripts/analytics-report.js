const { getTelemetryAnalytics } = require('./telemetry-analytics');
const path = require('path');

const feedbackDir = process.env.RLHF_FEEDBACK_DIR || path.join(__dirname, '..', '.claude', 'memory', 'feedback');
const analytics = getTelemetryAnalytics(feedbackDir);

console.log(JSON.stringify(analytics, null, 2));
