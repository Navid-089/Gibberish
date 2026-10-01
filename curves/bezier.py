import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# Control points
P0 = np.array([0, 0])
P1 = np.array([0.5, 1])
P2 = np.array([1, 0])

# Quadratic Bézier point function
def bezier_point(t, P0, P1, P2):
    return (1 - t)**2 * P0 + 2 * (1 - t) * t * P1 + t**2 * P2

# Generate full curve for reference
t_vals = np.linspace(0, 1, 200)
curve = np.array([bezier_point(t, P0, P1, P2) for t in t_vals])

# Setup figure
fig, ax = plt.subplots()
ax.set_aspect('equal')
ax.set_xlim(-0.1, 1.1)
ax.set_ylim(-0.1, 1.1)
ax.set_title("Quadratic Bézier Construction (3 Points)")
ax.plot(curve[:, 0], curve[:, 1], 'b-', lw=2, label='Bézier curve')
ax.plot([P0[0], P1[0], P2[0]], [P0[1], P1[1], P2[1]], 'ro--', label='Control lines')
ax.legend()

# Initialize moving elements
point_curve, = ax.plot([], [], 'ko', markersize=10, label='Curve point')
point_a, = ax.plot([], [], 'go', markersize=8, label='Point A (P0→P1)')
point_b, = ax.plot([], [], 'go', markersize=8, label='Point B (P1→P2)')
line_ab, = ax.plot([], [], 'g--', lw=1)

# Update function
def update(frame):
    t = t_vals[frame]

    # Moving points on control lines
    A = (1 - t) * P0 + t * P1
    B = (1 - t) * P1 + t * P2

    # Moving point on the line connecting A and B
    C = (1 - t) * A + t * B

    # Update visuals
    point_a.set_data([A[0]], [A[1]])
    point_b.set_data([B[0]], [B[1]])
    line_ab.set_data([A[0], B[0]], [A[1], B[1]])
    point_curve.set_data([C[0]], [C[1]])

    return point_a, point_b, line_ab, point_curve

# Animate
anim = FuncAnimation(fig, update, frames=len(t_vals), interval=30, blit=True, repeat=True)

plt.show()
