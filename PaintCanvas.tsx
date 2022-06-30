import React, { Component, RefObject } from "react";
import {
  StyleSheet,
  View,
  PanResponder,
  GestureResponderEvent,
  LayoutRectangle,
  LayoutChangeEvent,
  Button,
  PanResponderInstance,
} from "react-native";
import Svg, { G, Path, Circle } from "react-native-svg";
import ViewShot, { captureRef } from "react-native-view-shot-with-web-support";
import ColorPicker from "react-native-wheel-color-picker";

interface PaintCanvasProps {
  width: number;
  height: number;
  onConvertToImage?: (base64: string) => void;
}

interface PaintCanvasState {
  currentPoints: { x: number; y: number }[];
  currentPath: React.ReactNode;
  completedPaths: React.ReactNode[];
  strokeColor: string;
  strokeSize: number;
}

class PaintCanvas extends Component<PaintCanvasProps, PaintCanvasState> {
  private _panResponder: PanResponderInstance;
  private _pointsToSvgConverter: PointsToSvgConverter;
  private _viewShotRef: RefObject<ViewShot>;

  constructor(props: PaintCanvasProps) {
    super(props);

    this.state = {
      currentPoints: [],
      currentPath: <Path />,
      completedPaths: [],
      strokeColor: "",
      strokeSize: 3,
    };

    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const newPoints = this.state.currentPoints;

        const [x, y] = [e.nativeEvent.pageX, e.nativeEvent.pageY];
        newPoints.push({ x, y });

        this.setState({ currentPoints: newPoints });
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const newPoints = this.state.currentPoints;
        let newCurrentPath = this.state.currentPath;

        const [x, y] = [e.nativeEvent.pageX, e.nativeEvent.pageY];
        newPoints.push({ x, y });

        if (this.state.currentPoints.length > 1) {
          newCurrentPath = (
            <Path
              d={this._pointsToSvgConverter.pointsToSvgPath(newPoints)}
              stroke={this.state.strokeColor}
              strokeWidth={this.state.strokeSize}
              fill="none"
            />
          );
        }

        this.setState({
          currentPoints: newPoints,
          currentPath: newCurrentPath,
        });
      },
      onPanResponderRelease: () => {
        const newFinalPaths = this.state.completedPaths;

        if (this.state.currentPoints.length > 1) {
          newFinalPaths.push(this.state.currentPath);
        }

        if (this.state.currentPoints.length === 1) {
          newFinalPaths.push(
            <Circle
              cx={`${
                this._pointsToSvgConverter.pointToSvgCircle(
                  this.state.currentPoints[0]
                ).x
              }`}
              cy={`${
                this._pointsToSvgConverter.pointToSvgCircle(
                  this.state.currentPoints[0]
                ).y
              }`}
              r={`${this.state.strokeSize / 2}`}
              stroke={this.state.strokeColor}
              fill={this.state.strokeColor}
            />
          );
        }

        this.setState({
          currentPoints: [],
          currentPath: <Path />,
          completedPaths: newFinalPaths,
        });
      },
    });

    this._pointsToSvgConverter = new PointsToSvgConverter();

    this._viewShotRef = React.createRef<ViewShot>();
  }

  private _convertPaintCanvasToImage() {
    captureRef(this._viewShotRef, {
      result: "base64",
      quality: 1.0,
    }).then((base64: string) => {
      this.props.onConvertToImage(base64);
    });
  }

  private _convertPaintCanvasToImageCallback =
    this._convertPaintCanvasToImage.bind(this);

  render(): React.ReactNode {
    return (
      <View
        onLayout={(e: LayoutChangeEvent) =>
          this._pointsToSvgConverter.setOffsets(e.nativeEvent.layout)
        }
        style={styles.paintCanvasContainer}
        {...this._panResponder.panHandlers}
      >
        <ViewShot ref={this._viewShotRef}>
          <Svg
            style={styles.paintCanvasSurface}
            width={this.props.width >= 200 ? this.props.width : 200}
            height={this.props.height >= 200 ? this.props.height : 200}
          >
            <G>{this.state.completedPaths}</G>
            <G>{this.state.currentPath}</G>
          </Svg>
        </ViewShot>
        <View style={styles.paintCanvasContainer}>
          <ColorPicker
            onColorChangeComplete={(color: string) => {
              this.setState({ strokeColor: color });
            }}
          />
        </View>
        <View style={styles.paintCanvasContainer}>
          <Button
            onPress={this._convertPaintCanvasToImageCallback}
            title="Capture Paint Canvas"
            color="#324aa8"
          />
        </View>
      </View>
    );
  }
}

class PointsToSvgConverter {
  private _offsetX: number = 0;
  private _offsetY: number = 0;

  setOffsets(layout: LayoutRectangle): void {
    this._offsetX = layout.x;
    this._offsetY = layout.y;
  }

  pointsToSvgPath(points: { x: number; y: number }[]): string {
    if (points.length > 0) {
      let path = `M ${points[0].x - this._offsetX}, ${
        points[0].y - this._offsetY
      } L`;
      points.forEach((point: { x: number; y: number }) => {
        path = `${path} ${point.x - this._offsetX}, ${
          point.y - this._offsetY
        } `;
      });
      return path;
    } else {
      return "";
    }
  }

  pointToSvgCircle(point: { x: number; y: number }): {
    x: string;
    y: string;
  } {
    return { x: `${point.x - this._offsetX}`, y: `${point.y - this._offsetY}` };
  }
}

const styles = StyleSheet.create({
  paintCanvasContainer: {
    borderWidth: 0.5,
    borderColor: "#dddddd",
  },

  paintCanvasSurface: {
    backgroundColor: "transparent",
  },
});

export default PaintCanvas;
