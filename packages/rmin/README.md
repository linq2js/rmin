# rmin

A mini store for React

## Installation

**NPM**

```bash
npm i rmin --save
```

**YARN**

```bash
yarn add rmin
```

## Recipes

### Creating a simple store

```js
import { create } from "rmin";

const counter = create(
  // initial state
  1,
  // counter methods builder
  () => ({
    // state reducer
    add: () => state + 1,
  })
);

console.log(counter.state); // 1
counter.add();
console.log(counter.state); // 2
```

### Using rmin store with React components

```jsx
import { create, useStore } from "rmin";

const App = () => {
  // useStore returns current state of the input store
  const count = useStore(counter);

  return (
    <>
      <h1>{count}</h1>
      {/* bind add method to onClick event */}
      <button onClick={counter.add}>Add</button>
    </>
  );
};
```

### Selecting state slice from the store

```jsx
import { useStore, shallow } from "rmin";

const App = () => {
  const { title, completed, toggle, update } = useStore(
    todo,
    // passing a selector as second param of useStore
    (store) => (
      {
        // select some props of the state
        title: store.state.title,
        completed: store.state.completed,
        // select some methods of the store
        toggle: store.toggle,
        update: store.update,
      },
      // by default, rmin uses strict comparer for selector result,
      // if selector result is object, the host component alway re-renders when the state change
      // using shallow comparer to optimize rendering
      shallow
    )
  );
  return <h1>{fullName}</h1>;
};
```

### Memoizable properties

```js
import { create, memo } from "rmin";

const todos = create({ todos: [], filter: "all" }, (state) => ({
  // using memo() to mark this is memoziable property
  // the memoizable property is only evaluated when the dependency values changed
  filteredTodos: memo(
    () => {
      // all todos
      if (state.filter === "all") {
        return state.todos;
      }
      // completed todos
      if (state.filter === "completed") {
        return state.todos.filter((x) => x.completed);
      }
      // incompleted todos
      return state.todos.filter((x) => !x.completed);
    },
    // indicate dependency values
    [state.filter, state.todos]
  ),
  add() {},
  remove() {},
}));
```

### Calling other method

```js
import { create } from "rmin";

const counter = create(0, (state) => ({
  add: () => state + 1,
  addTwo() {
    return this.add() + this.add();
  },
}));
```

### Calling asynchronous reducer

```js
import { create } from "rmin";

const counter = create(0, (state) => ({
  add: () => state + 1,
  async asyncAdd() {
    await delay(500);
    return this.add();
  },
}));

counter.asyncAdd();
console.log(counter.state); // 0
// wait in 1 second
console.log(counter.state); // 1

counter.asyncAdd();
counter.asyncAdd();
counter.asyncAdd();
counter.asyncAdd();
// wait in 1 second
console.log(counter.state); // 2
// remark: only the first one is affected, others are not because the states of those are outdated after the first one is updated
```
