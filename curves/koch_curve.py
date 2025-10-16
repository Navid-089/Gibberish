import matplotlib.pyplot as plt
import numpy as np

# Recursive function to generate Koch curve points
def koch_curve(p1, p2, level):
    if level == 0:
        return [p1, p2]

    p1 = np.array(p1)
    p2 = np.array(p2)
    diff = p2 - p1
    one_third = p1 + diff / 3
    two_third = p1 + 2 * diff / 3

    # Create the equilateral triangle peak
    angle = np.pi / 3
    rotation = np.array([
        [np.cos(angle), -np.sin(angle)],
        [np.sin(angle), np.cos(angle)]
    ])
    peak = one_third + rotation @ (diff / 3)

    # Build recursively
    result = []
    result += koch_curve(p1, one_third, level - 1)[:-1]
    result += koch_curve(one_third, peak, level - 1)[:-1]
    result += koch_curve(peak, two_third, level - 1)[:-1]
    result += koch_curve(two_third, p2, level - 1)
    return result

# --- Setup ---
level = 0
max_level = 7
p1, p2 = [0, 0], [1, 0]

fig, ax = plt.subplots()
ax.set_aspect('equal')
ax.axis('off')

def draw_curve():
    ax.clear()
    ax.set_aspect('equal')
    ax.axis('off')
    points = np.array(koch_curve(p1, p2, level))
    ax.plot(points[:, 0], points[:, 1], 'b-')
    ax.set_title(f'Koch Curve (Iteration {level})')
    plt.draw()

def on_key(event):
    global level
    if event.key == 'n':
        if level < max_level:
            level += 1
            draw_curve()
            plt.pause(0.01)  # ensure update happens before next keypress
        else:
            print("✅ Maximum iteration reached.")
    elif event.key == 'r':
        level = 0
        draw_curve()

# Bind key event
fig.canvas.mpl_connect('key_press_event', on_key)

# Initial draw
draw_curve()
plt.show()
