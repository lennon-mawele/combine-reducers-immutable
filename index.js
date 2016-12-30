/**
 * The default `combineReducers` requires plain JavaScript objects.
 * We however want to use ImmutableJS, and thus modifications are needed.
 *
 * Existing implementations of this exist (like 'redux-immutable'), but those
 * that I have seen don't include the useful error messages that the original
 * function provides. Hence my implementation.
 *
 * All functionality is preserved from the original, except `state` must be
 * an ImmutableJS Map.
 *
 */

import Immutable from 'immutable'

// Inline redux's local imports to keep this all in one file.

// INLINE: import { ActionTypes } from './createStore'
const ActionTypes = {
  INIT: '@@redux/INIT'
}

// INLINE: import warning from './utils/warning'
/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message)
  }
  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message)
  } catch (e) { }
}

// ***************
// END BOILERPLATE
// ***************


const NODE_ENV = typeof process !== 'undefined' ? process.env.NODE_ENV : 'development'

function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type
  const actionName = actionType && `"${actionType.toString()}"` || 'an action'

  return (
    `Given action ${actionName}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state.`
  )
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
  const reducerKeys = Object.keys(reducers)
  const argumentName = action && action.type === ActionTypes.INIT ?
    'preloadedState argument passed to createStore' :
    'previous state received by the reducer'

  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }

  // Ensure input state is an Immutable Map
  if (!Immutable.Map.isMap(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      ({}).toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an Immutable Map with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }

  const unexpectedKeys = inputState.keySeq().filter(key =>
    !reducers.hasOwnProperty(key) &&
    !unexpectedKeyCache[key]
  )

  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

function assertReducerSanity(reducers) {
  Object.keys(reducers).forEach(reducerName => {
    const reducer = reducers[reducerName]
    const initialState = reducer(undefined, { type: ActionTypes.INIT })

    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${reducerName}" returned undefined during initialization. ` +
        `If the state passed to the reducer is undefined, you must ` +
        `explicitly return the initial state. The initial state may ` +
        `not be undefined.`
      )
    }

    const type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.')
    if (typeof reducer(undefined, { type }) === 'undefined') {
      throw new Error(
        `Reducer "${reducerName}" returned undefined when probed with a random type. ` +
        `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
        `namespace. They are considered private. Instead, you must return the ` +
        `current state for any unknown actions, unless it is undefined, ` +
        `in which case you must return the initial state, regardless of the ` +
        `action type. The initial state may not be undefined.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
export default function combineReducers(reducers) {
  const reducerNames = Object.keys(reducers)
  const finalReducers = {}
  reducerNames.forEach(reducerName => {
    if (NODE_ENV !== 'production' && typeof reducers[reducerName] === 'undefined') {
      warning(`No reducer provided for key "${reducerName}"`)
    }
    if (typeof reducers[reducerName] === 'function') {
      finalReducers[reducerName] = reducers[reducerName]
    }
  })

  const finalReducerNames = Object.keys(finalReducers)

  let unexpectedKeyCache
  if (NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }

  let sanityError
  try {
    assertReducerSanity(finalReducers)
  } catch (e) {
    sanityError = e
  }

  // `state = {}` -> `state = Immutable.Map()`
  return function combination(state = Immutable.Map(), action) {
    if (sanityError) {
      throw sanityError
    }

    if (NODE_ENV !== 'production') {
      const warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache)
      if (warningMessage) {
        warning(warningMessage)
      }
    }

    return state.withMutations(transientState =>
      finalReducerNames.forEach(reducerName => {
        const reducer = finalReducers[reducerName]
        const currentStateForReducer = transientState.get(reducerName)
        const nextStateForReducer = reducer(currentStateForReducer, action)

        if (typeof nextStateForReducer === 'undefined') {
          const errorMessage = getUndefinedStateErrorMessage(reducerName, action)
          throw new Error(errorMessage)
        }

        transientState.set(reducerName, nextStateForReducer)
      })
    )
    // ORIGINAL CODE:
    // let hasChanged = false
    // const nextState = {}
    // for (let i = 0; i < finalReducerKeys.length; i++) {
    //   const key = finalReducerKeys[i]
    //   const reducer = finalReducers[key]
    //   const previousStateForKey = state[key]
    //   const nextStateForKey = reducer(previousStateForKey, action)
    //   if (typeof nextStateForKey === 'undefined') {
    //     const errorMessage = getUndefinedStateErrorMessage(key, action)
    //     throw new Error(errorMessage)
    //   }
    //   nextState[key] = nextStateForKey
    //   hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    // }
    // return hasChanged ? nextState : state
  }
}