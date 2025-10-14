/* Converting to Homogenous co-ordinates, then performing rotation, transformation, scaling and then coming back. Just the matrix calculations. cpp. */

#include <bits/stdc++.h>
using namespace std;
#include <cmath>
#define PI 3.14159265
#define DEG2RAD(deg) (deg * PI / 180.0)
#define RAD2DEG(rad) (rad * 180.0 / PI)


class Point {
public:
    double x, y;
    Point(double x = 0, double y = 0) : x(x), y(y) {}
};      

class Matrix3x3 {
public:
    double m[3][3];
    Matrix3x3() {
        for (int i = 0; i < 3; ++i)
            for (int j = 0; j < 3; ++j)
                m[i][j] = (i == j) ? 1 : 0; // Identity matrix
    }

    Matrix3x3 operator*(const Matrix3x3& other) const {
        Matrix3x3 result;
        for (int i = 0; i < 3; ++i) {
            for (int j = 0; j < 3; ++j) {
                result.m[i][j] = 0;
                for (int k = 0; k < 3; ++k) {
                    result.m[i][j] += m[i][k] * other.m[k][j];
                }
            }
        }
        return result;
    }

    Point operator*(const Point& p) const {
        double x = m[0][0] * p.x + m[0][1] * p.y + m[0][2] * 1;
        double y = m[1][0] * p.x + m[1][1] * p.y + m[1][2] * 1;
        double w = m[2][0] * p.x + m[2][1] * p.y + m[2][2] * 1;
        return Point(x / w, y / w);
    }

    static Matrix3x3 translation(double tx, double ty) {
        Matrix3x3 result;
        result.m[0][2] = tx;
        result.m[1][2] = ty;
        return result;
    }

    static Matrix3x3 rotation(double angle) {
        Matrix3x3 result;
        double rad = DEG2RAD(angle);
        result.m[0][0] = cos(rad);
        result.m[0][1] = -sin(rad);
        result.m[1][0] = sin(rad);
        result.m[1][1] = cos(rad);
        return result;
    }

    static Matrix3x3 scaling(double sx, double sy) {
        Matrix3x3 result;
        result.m[0][0] = sx;
        result.m[1][1] = sy;
        return result;
    }

    static Matrix3x3 reflection(bool overX = false, bool overY = false) {
        Matrix3x3 result;
        if (overX) result.m[1][1] = -1;
        if (overY) result.m[0][0] = -1;
        return result;
    }

    static Matrix3x3 shear(double shx, double shy) {
        Matrix3x3 result;
        result.m[0][1] = shx;
        result.m[1][0] = shy;
        return result;
    }

    static Matrix3x3 custom(double m00, double m01, double m02,
                            double m10, double m11, double m12,
                            double m20, double m21, double m22) {
        Matrix3x3 result;
        result.m[0][0] = m00; result.m[0][1] = m01; result.m[0][2] = m02;
        result.m[1][0] = m10; result.m[1][1] = m11; result.m[1][2] = m12;
        result.m[2][0] = m20; result.m[2][1] = m21; result.m[2][2] = m22;
        return result;
    }

    void print() const {
        for (int i = 0; i < 3; ++i) {
            for (int j = 0; j < 3; ++j) {
                cout << m[i][j] << " ";
            }
            cout << endl;
        }
    }

    static Matrix3x3 rotationAroundPoint(double angle, double px, double py) {
        return translation(px, py) * rotation(angle) * translation(-px, -py);
    }

    static Matrix3x3 scalingAroundPoint(double sx, double sy, double px, double py) {
        return translation(px, py) * scaling(sx, sy) * translation(-px, -py);
    }

    static Matrix3x3 reflectionAroundPoint(bool overX, bool overY, double px, double py) {
        return translation(px, py) * reflection(overX, overY) * translation(-px, -py);
    }

    static Matrix3x3 shearAroundPoint(double shx, double shy, double px, double py) {
        return translation(px, py) * shear(shx, shy) * translation(-px, -py);
    }

};

int main() {
    Point p(1, 1);
    cout << "Original Point: (" << p.x << ", " << p.y << ")\n";

    Matrix3x3 trans = Matrix3x3::translation(2, 3);

    Matrix3x3 rot = Matrix3x3::rotation(45);

    Matrix3x3 scale = Matrix3x3::scaling(2, 2);

    Matrix3x3 shear = Matrix3x3::shear(1, 0);

    Matrix3x3 reflect = Matrix3x3::reflection(true, false);

    Matrix3x3 combined = trans * rot * scale * shear * reflect;

    Point transformed = combined * p;
    cout << "Transformed Point: (" << transformed.x << ", " << transformed.y <<
            ")\n";
    return 0;
}



