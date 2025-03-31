const express = require('express');
const router = express.Router();
const replicateService = require('../services/replicateService');
const validator = require('../middleware/validator');

/**
 * POST /generate
 * Generate images using Replicate API and return their URLs directly
 */
router.post('/', validator.validateGenerateRequest, async (req, res, next) => {
  try {
    const {
      prompt,
      negative_prompt = "nsfw, naked",
      steps = 28,
      width = 1024,
      height = 1024,
      batch_size = 1,
      // Include other parameters as needed
    } = req.body;

    // Create input object for Replicate API
    const input = {
      prompt,
      negative_prompt,
      steps,
      width,
      height,
      batch_size,
      model: "Animagine-XL-4.0",
      vae: "default",
      scheduler: "Euler a",
      prepend_preprompt: true,
      cfg_scale: 5,
      pag_scale: 3,
      guidance_rescale: 0.5,
      clip_skip: 1,
      seed: -1, // Random seed
    };

    console.log('Creating prediction with input:', input);

    // Create prediction
    const prediction = await replicateService.createPrediction(input);
    console.log('Prediction created:', prediction.id);

    // Wait for prediction to complete
    const completedPrediction = await replicateService.waitForPrediction(prediction.id);
    console.log('Prediction completed:', completedPrediction.id);

    if (!completedPrediction.output || !Array.isArray(completedPrediction.output)) {
      throw new Error('Invalid prediction output');
    }

    // Return the URLs directly from Replicate without uploading to MinIO
    const urls = completedPrediction.output;

    // Return the URLs of the generated images
    res.status(200).json({ urls });
  } catch (error) {
    console.error('Error in generate endpoint:', error);
    next(error);
  }
});

module.exports = router;
