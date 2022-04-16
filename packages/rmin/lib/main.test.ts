import { create, memo } from "./main";

test("simple store", () => {
  const counter = create(1, (state) => ({
    increment: () => state + 1,
  }));
  expect(counter.state).toBe(1);
  counter.increment();
  expect(counter.state).toBe(2);
});

test("memo", () => {
  let fullNameChanged = 0;
  const useProfile = create(
    { firstName: "hung", lastName: "nguyen", photo: "" },
    (state) => ({
      fullName: memo(() => {
        fullNameChanged++;
        return `${state.firstName} ${state.lastName}`;
      }, [state.firstName, state.lastName]),
      updateName: () => ({
        ...state,
        firstName: "Hello",
        lastName: "World",
      }),
      updatePhoto: () => ({
        ...state,
        photo: Math.random().toString(),
      }),
    })
  );
  expect(useProfile.fullName).toBe("hung nguyen");
  expect(fullNameChanged).toBe(1);
  expect(useProfile.fullName).toBe("hung nguyen");
  expect(useProfile.fullName).toBe("hung nguyen");
  expect(useProfile.fullName).toBe("hung nguyen");
  expect(fullNameChanged).toBe(1);
  useProfile.updatePhoto();
  expect(useProfile.fullName).toBe("hung nguyen");
  expect(fullNameChanged).toBe(1);
  useProfile.updateName();
  expect(useProfile.fullName).toBe("Hello World");
  expect(fullNameChanged).toBe(2);
});
