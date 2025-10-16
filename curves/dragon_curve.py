import matplotlib.pyplot as plt
import numpy as np

# --- Generate Dragon Curve points ---
def dragon_curve(p1, p2, level):
    if level == 0:
        return [p1, p2]

    p1 = np.array(p1)
    p2 = np.array(p2)

    # midpoint rotation (rotate 90° around midpoint)
    mid = (p1 + p2) / 2
    diff = p2 - p1
    rot90 = np.array([[0, -1], [1, 0]])  # rotate 90° CCW
    new_point = mid + (rot90 @ (diff / 2))

    # recursively build both halves
    first_half = dragon_curve(p1, new_point, level - 1)[:-1]
    second_half = dragon_curve(new_point, p2, level - 1)
    return first_half + second_half


# --- Setup ---
level = 0
max_level = 15  # dragon curve grows very fast
p1, p2 = [0, 0], [1, 0]

fig, ax = plt.subplots()
ax.set_aspect('equal')
ax.axis('off')

def draw_curve():
    ax.clear()
    ax.set_aspect('equal')
    ax.axis('off')
    points = np.array(dragon_curve(p1, p2, level))
    ax.plot(points[:, 0], points[:, 1], 'r-', lw=1)
    ax.set_title(f'Dragon Curve (Iteration {level})')
    plt.draw()

def on_key(event):
    global level
    if event.key == 'n':
        if level < max_level:
            level += 1
            draw_curve()
            plt.pause(0.01)
        else:
            print("✅ Maximum iteration reached.")
    elif event.key == 'r':
        level = 0
        draw_curve()

fig.canvas.mpl_connect('key_press_event', on_key)

# Initial draw
draw_curve()
plt.show()
