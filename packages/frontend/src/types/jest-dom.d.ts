/**
 * Registers @testing-library/jest-dom's matchers (`toBeInTheDocument`,
 * `toBeDisabled`, …) with TypeScript. Importing the package in jest.setup.js
 * makes them work at runtime but not in the type checker, so without this the
 * tests pass while `tsc --noEmit` fails on every matcher.
 */
import '@testing-library/jest-dom';
