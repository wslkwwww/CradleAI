

**Core Concepts**

*   **Reanimated's Goal:** To enable performant, complex animations in React Native by running animation logic directly on the UI thread.

**1. Animated Components**

*   **Definition:**  React Native components that Reanimated can animate.  These components have animatable properties and styles.
*   **Built-in Components:** `Animated.View`, `Animated.Text`, `Animated.ScrollView` (and likely others).
*   **Custom Components:** Use `Animated.createAnimatedComponent()` to wrap standard React Native components (or third-party components) to make their props and styles animatable.

    ```javascript
    import Animated from 'react-native-reanimated';
    import { Circle } from 'react-native-svg';

    const AnimatedCircle = Animated.createAnimatedComponent(Circle);
    ```

**2. Shared Values**

*   **Definition:**  The central mechanism for controlling animations in Reanimated.  They hold data that's automatically synchronized between the JavaScript thread and the UI thread.
*   **Creation:** Use the `useSharedValue()` hook.
*   **Access/Modification:** Access and modify the value using the `.value` property.

    ```javascript
    import { useSharedValue } from 'react-native-reanimated';

    function App() {
      const sv = useSharedValue(0);

      const handlePress = () => {
        sv.value += 10;
      };

      // ...
    }
    ```
*   **Data Types:** Can hold values of any type.

**3. Animatable Value**

*   **Definition:** A value that can be animated, including numbers, strings, and arrays of numbers.
*   **String values:** Strings that are in a specific format like "10deg", "21%", or even colors like "#ffaabb" or "rgba(100, 200, 100, 0.7)".

**4. Animation Functions**

*   **Definition:** Functions that create animations, defining how they behave.
*   **Built-in Functions:**
    *   `withSpring()`: Spring-based animation.
    *   `withTiming()`: Duration and easing-based animation.
    *   `withDecay()`: Deceleration-based animation.

**5. Animation Modifiers**

*   **Definition:** Functions used to customize animations (also called higher-order animations).
*   **Built-in Modifiers:**
    *   `withDelay()`: Adds a delay before the animation starts.
    *   `withRepeat()`: Repeats an animation a specific number of times.
    *   `withSequence()`: Chains animations one after the other.
    *   `withClamp()`: Limit the animation boundaries to a specified range.

**6. Animation Objects**

*   **Definition:** Values returned by animation functions and modifiers. They hold the animation's current state, start/end conditions, and an `onFrame` function.
*   **Usage:** When assigned to a shared value, it's treated as an animatable value. The final result stored in the shared value is the current state of the animation.

    ```javascript
    sv.value = withSpring(100); // sv.value will be a number as the animation progresses
    ```

**7. Animations in Inline Styling**

*   You can pass shared values directly to the style property without the use of `useAnimatedStyle`.
    ```javascript
    function App() {
      const width = useSharedValue(100);

      return <Animated.View style={{ width }} />;
    }
    ```

**8. Layout Animation Modifiers**

*   **Definition:** Methods used to customize layout animations (e.g., entering/exiting animations).
*   **Example:**

    ```javascript
    <Animated.View entering={FadeOutLeft.duration(500).easing(Easing.ease)} />
    ```

*   **Common Modifiers:**
    *   `.duration(durationMs: number)`: Animation length in milliseconds.
    *   `.easing(easingFunction: EasingFunction)`:  Easing function to define the animation curve.
    *   `.springify()`: Enables spring-based animation configuration.
    *   `.damping(value: number)`: Controls spring damping.
    *   `.withCallback(callback: (finished: boolean) => void)`: Callback function executed after animation completion.

**9. Worklets**

*   **Definition:** Short-running JavaScript functions that can run on the UI thread (or JavaScript thread).
*   **Automatic Workletization:** Reanimated automatically workletizes code in many cases (especially within hooks like `useAnimatedStyle`).
*   **Explicit Worklets:**  Create worklets manually using the `"worklet";` directive at the top of a function.

    ```javascript
    function myWorklet() {
      'worklet';
      console.log('Running on the UI thread');
    }
    ```

*   **`runOnUI()`:** Manually run a worklet on the UI thread.

    ```javascript
    import { runOnUI } from 'react-native-reanimated';

    function myWorklet(greeting) {
      'worklet';
      console.log(`${greeting} from the UI thread`);
    }

    function onPress() {
      runOnUI(myWorklet)('Howdy');
    }
    ```

**10. To Workletize**

*   **Definition:** The process of converting a JavaScript function into a serializable object that can be copied and run on the UI thread.
*   **Reanimated Babel Plugin:** Automatically picks up functions marked with `"worklet";` and workletizes them.

**11. Threads**

*   **JavaScript Thread (JS Thread):**  Handles JavaScript code execution in the app. This is where your main React Native application code runs.
*   **UI Thread (Main Thread):** Handles user interface updates.  Reanimated aims to offload animation logic to this thread for smoother performance.

**12. Reanimated Babel Plugin**

*   **Purpose:** Automates workletization of functions, reducing boilerplate code.  See the plugin's README for details.
