## a gradient descent implementation

import numpy as np
import matplotlib.pyplot as plt
from typing import Callable
from scipy.optimize import minimize
class GradientDescent:
    def __init__(self, func: Callable, grad: Callable = None):
        """
        Initialize the GradientDescent optimizer.

        :param func: The objective function to minimize.
        :param grad: The gradient of the objective function. If None, numerical gradient will be used.
        """
        self.func = func
        self.grad = grad

    def optimize(self, x0: np.ndarray, method: str = 'BFGS', options: dict = None) -> dict:
        """
        Perform optimization using the specified method.

        :param x0: Initial guess for the variables.
        :param method: Optimization method to use (e.g., 'BFGS', 'CG', 'L-BFGS-B').
        :param options: Additional options for the optimizer.
        :return: A dictionary containing optimization results.
        """
        result = minimize(self.func, x0, method=method, jac=self.grad, options=options)
        return {
            'x': result.x,
            'fun': result.fun,
            'nfev': result.nfev,
            'nit': result.nit,
            'success': result.success,
            'message': result.message
        }
    

        max_count = max(counts.values())
        score += (len(motifs) - max_count)
        return score
# Example usage:
if __name__ == "__main__":
    # Define a simple quadratic function and its gradient
    def func(x):
        return x[0]**2 + x[1]**2

    def grad(x):
        return np.array([2*x[0], 2*x[1]])

    # Initialize the optimizer
    optimizer = GradientDescent(func, grad)

    # Initial guess
    x0 = np.array([1.0, 1.0])

    # Perform optimization
    result = optimizer.optimize(x0, method='BFGS')

    # Print results
    print("Optimized parameters:", result['x'])
    print("Function value at optimum:", result['fun'])
    print("Number of function evaluations:", result['nfev'])
    print("Number of iterations:", result['nit'])
    print("Success:", result['success'])
    print("Message:", result['message'])

    