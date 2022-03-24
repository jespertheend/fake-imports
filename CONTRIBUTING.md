## Getting the code

1. Clone this repository

```
git clone https://github.com/jespertheend/fake-imports.git
cd fake-imports
```

2. [Install Deno](https://deno.land/#installation)

## Running tests

```
deno task test
```

Or if you wish to only run a specific test:

```
deno task test test/unit/src/ImportResolver.test.js
```

## Code style

When submitting a PR, you can run

```
deno task check
```

This runs the linter, formatter and finally all the tests. This is generally
required to pass in order for ci to pass.
