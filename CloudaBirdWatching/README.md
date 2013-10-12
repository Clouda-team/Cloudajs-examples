## About this demo
This demo is inspired by the iOS tutorial artical "Your Second iOS App: Storyboard", demonstrating the basic techniques for developing with Clouda Framework. This web app does everything as the iOS app can achieve, (actually a little bit more than the iOS version), as well as the favorable real-time sync features brought by Clouda Framework. This is targeted to beginners who is learning Clouda, and it is expected to instruct about these techniques:

1. Display a Clouda Web App screen.
2. Define data model, and associate the data with UI layout elements.
3. Manipulate data in both client and server side, adding, deleting, updating and querying.
4. Let the UI updates as data get changed (In fact, Clouda is doing almost everything about UI updates here).  
5. Switch sceens by redirecting to other pages/controllers, passing parameters between screens.         
6. Using user-defined libraries or 3rd party handlerhard helper libraries.
7. Validating data.

## Notice
1. This web app interact with touch events rather than standard click events in desktop web browsers. Therefore, when try it with your PC/MAC, it needs touch events emulation. For example, in the Chrome browser, tick on the option "Emulate touch events" in the developer console settings. 
2. For validating data, validationRules.js needs to be put to directory sumeru/src/ to replace the original one. If you don't use this validatingRules.js, other functions still work fine.
