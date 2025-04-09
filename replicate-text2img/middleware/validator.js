/**
 * Validate the request body for the generate endpoint
 */
function validateGenerateRequest(req, res, next) {
  const { prompt, width, height, steps, batch_size, email } = req.body;

  // Validate required fields
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: "prompt is required"
    });
  }

  // Validate email
  if (!email) {
    return res.status(400).json({
      success: false,
      error: "email is required"
    });
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "invalid email format"
    });
  }

  // Validate numeric fields
  if (width && (!Number.isInteger(width) || width < 1 || width > 4096)) {
    return res.status(400).json({
      success: false,
      error: "width must be an integer between 1 and 4096"
    });
  }

  if (height && (!Number.isInteger(height) || height < 1 || height > 4096)) {
    return res.status(400).json({
      success: false,
      error: "height must be an integer between 1 and 4096"
    });
  }

  if (steps && (!Number.isInteger(steps) || steps < 1 || steps > 100)) {
    return res.status(400).json({
      success: false,
      error: "steps must be an integer between 1 and 100"
    });
  }

  if (batch_size && (!Number.isInteger(batch_size) || batch_size < 1 || batch_size > 4)) {
    return res.status(400).json({
      success: false,
      error: "batch_size must be an integer between 1 and 4"
    });
  }

  next();
}

/**
 * Validate the request body for the retry endpoint
 */
function validateRetryRequest(req, res, next) {
  const { taskId, email } = req.body;

  // Validate required fields
  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: "taskId is required"
    });
  }
  
  // Validate email for retry
  if (!email) {
    return res.status(400).json({
      success: false,
      error: "email is required"
    });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "invalid email format"
    });
  }

  // Other fields are optional as they can be inherited from the original task
  next();
}

module.exports = {
  validateGenerateRequest,
  validateRetryRequest
};
