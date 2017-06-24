// import 'babel-polyfill';
import {
  evict,
  get,
  getCache,
  getEdit,
  print,
  put,
  reset,
  uuid,
} from './cache';

(function () {
  if (typeof window !== 'undefined' && window !== null) {
    (window as any).One = {
      getCache,
      put,
      get,
      getEdit,
      evict,
      reset,
      uuid,
      print,
    }
  }
})()

export {
  getCache,
  put,
  get,
  getEdit,
  evict,
  reset,
  uuid,
  print,
}
