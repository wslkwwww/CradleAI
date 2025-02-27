# Cradle Feature Design Documentation

## Overview
The Cradle (摇篮) feature is a unique AI companion development system that nurtures a perfect partner persona based on user interactions. The design emphasizes nurturing, growth, and emotional connection while maintaining simplicity and feminine appeal.

## Visual Design Elements

### Main Interface
- **Gradient Background**: Soft, dreamy gradients transitioning between gentle pastels (e.g., rose pink to lavender)
- **Central Growth Visualization**: 
  - A glowing orb/seed that gradually develops and transforms
  - Gentle pulsing animations synchronized with interaction frequency
  - Particle effects suggesting growth and nurturing

### Growth Stages
1. **Seed Stage**: Simple glowing point
2. **Sprout Stage**: Ethereal wisps forming basic shapes
3. **Bloom Stage**: Complex, beautiful patterns representing personality development
4. **Maturity Stage**: Full, harmonious visualization of the developed companion

### Progress Indicators
- Subtle growth rings expanding outward
- Floating particles that increase in complexity/pattern
- Soft glow intensity that varies with development progress

## Interaction Design

### Touch Interactions
- Gentle swipes create ripple effects
- Long press shows detailed development insights
- Double tap to view conversation impact analysis

### Growth Metrics Display
- Emotional resonance percentage
- Personality trait development progress
- Interaction quality indicators

## Color Palette
- Primary: `#FFE6E6` (Soft Pink)
- Secondary: `#E6E6FF` (Gentle Lavender)
- Accent: `#FFF0E6` (Warm Pearl)
- Text: `#4A4A4A` (Soft Charcoal)

## Typography
- Primary Font: Light, airy sans-serif
- Headers: Elegant, slightly playful curves
- Body Text: Clean, easily readable

## Animations

### Breathing Effect
- Subtle pulsing (3-4 second cycle)
- Opacity range: 85% - 100%
- Easing: easeInOutSine

### Growth Transitions
- Smooth morphing between stages
- Particle emission during significant developments
- Gentle floating motion for UI elements

## User Experience Notes

1. **First-time User Experience**
   - Welcoming animation introducing the concept
   - Simple tutorial highlighting nurturing aspects
   - Clear explanation of how interactions influence growth

2. **Progress Feedback**
   - Immediate visual feedback for each interaction
   - Weekly development summaries
   - Milestone celebrations with special animations

3. **Emotional Design Elements**
   - Heart rate-like pulsing effects
   - Warm, comforting color transitions
   - Nurturing-focused interaction prompts

## Technical Considerations

### Key Components
- `CradleContainer`: Main view container
- `GrowthVisualizer`: Central animation component
- `ProgressRings`: Development status indicators
- `InteractionFeedback`: Touch response system

### Animation Performance
- Use native drivers for core animations
- Optimize particle effects for mobile
- Implement smooth stage transitions

## Future Enhancements
1. Customizable growth visualizations
2. Haptic feedback integration
3. AR visualization options
4. Shared growth celebrations
5. Interactive growth journals