# Batch gradient descent vs Stochastic gradient descent comparison for a dummy dataset

import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_regression
from sklearn.preprocessing import StandardScaler
import time

class LinearRegression:
    def __init__(self, learning_rate=0.01, n_iterations=1000):
        self.learning_rate = learning_rate
        self.n_iterations = n_iterations
        self.weights = None
        self.bias = None
        self.cost_history = []
        
    def fit_batch(self, X, y):
        """Batch Gradient Descent"""
        # Initialize parameters
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0
        self.cost_history = []
        
        # Gradient descent
        for i in range(self.n_iterations):
            # Forward pass
            y_predicted = np.dot(X, self.weights) + self.bias
            
            # Compute cost (MSE)
            cost = (1 / (2 * n_samples)) * np.sum((y_predicted - y) ** 2)
            self.cost_history.append(cost)
            
            # Compute gradients
            dw = (1 / n_samples) * np.dot(X.T, (y_predicted - y))
            db = (1 / n_samples) * np.sum(y_predicted - y)
            
            # Update parameters
            self.weights -= self.learning_rate * dw
            self.bias -= self.learning_rate * db
    
    def fit_stochastic(self, X, y, seed=42):
        """Stochastic Gradient Descent"""
        np.random.seed(seed)
        # Initialize parameters
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0
        self.cost_history = []
        
        # SGD
        for i in range(self.n_iterations):
            # Shuffle the data
            indices = np.random.permutation(n_samples)
            
            epoch_cost = 0
            for idx in indices:
                # Select random sample
                xi = X[idx:idx+1]
                yi = y[idx:idx+1]
                
                # Forward pass
                y_predicted = np.dot(xi, self.weights) + self.bias
                
                # Compute cost for this sample
                cost = 0.5 * (y_predicted - yi) ** 2
                epoch_cost += cost[0]
                
                # Compute gradients
                dw = np.dot(xi.T, (y_predicted - yi))
                db = (y_predicted - yi)
                
                # Update parameters
                self.weights -= self.learning_rate * dw.flatten()
                self.bias -= self.learning_rate * db[0]
            
            # Average cost for the epoch
            avg_cost = epoch_cost / n_samples
            self.cost_history.append(avg_cost)
    
    def predict(self, X):
        return np.dot(X, self.weights) + self.bias

def generate_dataset(n_samples=1000, n_features=1, noise=10, random_state=42):
    """Generate a dummy dataset for regression"""
    X, y = make_regression(n_samples=n_samples, 
                          n_features=n_features, 
                          noise=noise, 
                          random_state=random_state)
    return X, y

def compare_algorithms():
    """Compare Batch GD vs Stochastic GD"""
    print("=== Batch vs Stochastic Gradient Descent Comparison ===\n")
    
    # Generate dataset
    X, y = generate_dataset(n_samples=1000, n_features=1, noise=10)
    
    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Initialize models
    batch_model = LinearRegression(learning_rate=0.01, n_iterations=100)
    sgd_model = LinearRegression(learning_rate=0.01, n_iterations=100)
    
    # Train Batch Gradient Descent
    print("Training Batch Gradient Descent...")
    start_time = time.time()
    batch_model.fit_batch(X_scaled, y)
    batch_time = time.time() - start_time
    
    # Train Stochastic Gradient Descent
    print("Training Stochastic Gradient Descent...")
    start_time = time.time()
    sgd_model.fit_stochastic(X_scaled, y)
    sgd_time = time.time() - start_time
    
    # Results
    print(f"\n=== Results ===")
    print(f"Batch GD - Final Cost: {batch_model.cost_history[-1]:.6f}")
    print(f"Batch GD - Training Time: {batch_time:.4f} seconds")
    print(f"Batch GD - Final Weights: {batch_model.weights}")
    print(f"Batch GD - Final Bias: {batch_model.bias:.6f}")
    
    print(f"\nSGD - Final Cost: {sgd_model.cost_history[-1]:.6f}")
    print(f"SGD - Training Time: {sgd_time:.4f} seconds")
    print(f"SGD - Final Weights: {sgd_model.weights}")
    print(f"SGD - Final Bias: {sgd_model.bias:.6f}")
    
    # Visualizations
    plt.figure(figsize=(15, 10))
    
    # Plot 1: Cost function convergence
    plt.subplot(2, 3, 1)
    plt.plot(batch_model.cost_history, label='Batch GD', linewidth=2)
    plt.plot(sgd_model.cost_history, label='Stochastic GD', linewidth=2)
    plt.title('Cost Function Convergence')
    plt.xlabel('Iterations')
    plt.ylabel('Cost (MSE)')
    plt.legend()
    plt.grid(True)
    
    # Plot 2: Dataset and predictions
    plt.subplot(2, 3, 2)
    plt.scatter(X, y, alpha=0.5, label='Data points')
    
    # Generate predictions for plotting
    X_plot = np.linspace(X.min(), X.max(), 100).reshape(-1, 1)
    X_plot_scaled = scaler.transform(X_plot)
    
    y_batch_pred = batch_model.predict(X_plot_scaled)
    y_sgd_pred = sgd_model.predict(X_plot_scaled)
    
    plt.plot(X_plot, y_batch_pred, color='red', linewidth=2, label='Batch GD')
    plt.plot(X_plot, y_sgd_pred, color='green', linewidth=2, label='SGD', linestyle='--')
    plt.title('Dataset and Fitted Lines')
    plt.xlabel('X')
    plt.ylabel('y')
    plt.legend()
    plt.grid(True)
    
    # Plot 3: Log scale convergence
    plt.subplot(2, 3, 3)
    plt.semilogy(batch_model.cost_history, label='Batch GD', linewidth=2)
    plt.semilogy(sgd_model.cost_history, label='Stochastic GD', linewidth=2)
    plt.title('Cost Convergence (Log Scale)')
    plt.xlabel('Iterations')
    plt.ylabel('Cost (MSE) - Log Scale')
    plt.legend()
    plt.grid(True)
    
    # Plot 4: Comparison table
    plt.subplot(2, 3, 4)
    plt.axis('off')
    
    comparison_data = [
        ['Algorithm', 'Final Cost', 'Training Time', 'Convergence'],
        ['Batch GD', f'{batch_model.cost_history[-1]:.4f}', f'{batch_time:.4f}s', 'Smooth'],
        ['Stochastic GD', f'{sgd_model.cost_history[-1]:.4f}', f'{sgd_time:.4f}s', 'Noisy']
    ]
    
    table = plt.table(cellText=comparison_data[1:], 
                     colLabels=comparison_data[0],
                     cellLoc='center',
                     loc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1.2, 1.5)
    plt.title('Algorithm Comparison', pad=20)
    
    # Plot 5: Cost difference over iterations
    plt.subplot(2, 3, 5)
    cost_diff = np.array(sgd_model.cost_history) - np.array(batch_model.cost_history)
    plt.plot(cost_diff, color='purple', linewidth=2)
    plt.title('Cost Difference (SGD - Batch)')
    plt.xlabel('Iterations')
    plt.ylabel('Cost Difference')
    plt.grid(True)
    plt.axhline(y=0, color='black', linestyle='--', alpha=0.5)
    
    # Plot 6: Residuals comparison
    plt.subplot(2, 3, 6)
    y_batch_full = batch_model.predict(X_scaled)
    y_sgd_full = sgd_model.predict(X_scaled)
    
    residuals_batch = y - y_batch_full
    residuals_sgd = y - y_sgd_full
    
    plt.scatter(y_batch_full, residuals_batch, alpha=0.5, label='Batch GD', color='red')
    plt.scatter(y_sgd_full, residuals_sgd, alpha=0.5, label='SGD', color='green')
    plt.title('Residuals Plot')
    plt.xlabel('Predicted Values')
    plt.ylabel('Residuals')
    plt.legend()
    plt.grid(True)
    plt.axhline(y=0, color='black', linestyle='--', alpha=0.5)
    
    plt.tight_layout()
    plt.show()
    
    # Analysis
    print(f"\n=== Analysis ===")
    print("Batch Gradient Descent:")
    print("  ✓ Uses entire dataset for each parameter update")
    print("  ✓ Smooth convergence to global minimum")
    print("  ✓ Guaranteed convergence for convex functions")
    print("  ✗ Computationally expensive for large datasets")
    print("  ✗ Memory intensive")
    
    print("\nStochastic Gradient Descent:")
    print("  ✓ Updates parameters after each sample")
    print("  ✓ Faster for large datasets")
    print("  ✓ Can escape local minima due to noise")
    print("  ✓ Lower memory requirements")
    print("  ✗ Noisy convergence")
    print("  ✗ May not converge to exact minimum")
    
    if batch_time < sgd_time:
        print(f"\n⚡ Batch GD was faster by {sgd_time - batch_time:.4f} seconds")
    else:
        print(f"\n⚡ SGD was faster by {batch_time - sgd_time:.4f} seconds")

def demonstrate_with_different_parameters():
    """Demonstrate the algorithms with different learning rates and dataset sizes"""
    print("\n=== Parameter Sensitivity Analysis ===\n")
    
    learning_rates = [0.001, 0.01, 0.1]
    dataset_sizes = [100, 500, 1000]
    
    results = []
    
    for lr in learning_rates:
        for size in dataset_sizes:
            print(f"Testing: Learning Rate = {lr}, Dataset Size = {size}")
            
            # Generate dataset
            X, y = generate_dataset(n_samples=size, n_features=1, noise=10)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # Train models
            batch_model = LinearRegression(learning_rate=lr, n_iterations=50)
            sgd_model = LinearRegression(learning_rate=lr, n_iterations=50)
            
            start_time = time.time()
            batch_model.fit_batch(X_scaled, y)
            batch_time = time.time() - start_time
            
            start_time = time.time()
            sgd_model.fit_stochastic(X_scaled, y)
            sgd_time = time.time() - start_time
            
            results.append({
                'lr': lr,
                'size': size,
                'batch_cost': batch_model.cost_history[-1],
                'sgd_cost': sgd_model.cost_history[-1],
                'batch_time': batch_time,
                'sgd_time': sgd_time
            })
    
    # Display results
    print("\n" + "="*80)
    print(f"{'LR':<6} {'Size':<6} {'Batch Cost':<12} {'SGD Cost':<12} {'Batch Time':<12} {'SGD Time':<12} {'Winner':<10}")
    print("="*80)
    
    for result in results:
        winner = "Batch" if result['batch_cost'] < result['sgd_cost'] else "SGD"
        print(f"{result['lr']:<6} {result['size']:<6} {result['batch_cost']:<12.6f} "
              f"{result['sgd_cost']:<12.6f} {result['batch_time']:<12.6f} "
              f"{result['sgd_time']:<12.6f} {winner:<10}")

if __name__ == "__main__":
    # Run the main comparison
    compare_algorithms()
    
    # Run parameter sensitivity analysis
    demonstrate_with_different_parameters()
    
    print("\n🎉 Analysis complete! Check the plots for visual comparison.")