import React, { Component } from 'react';
import {
  StyleSheet,
  View,
  PanResponder,
  GestureResponderEvent,
  LayoutRectangle,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

type PaintCanvasProps = {
  width: number;
  height: number;
  color: string;
  strokeSize: number;
};

type PaintCanvasState = {
  points: { x: number; y: number }[];
  intermediatePaths: JSX.Element[];
  finalPaths: JSX.Element[];
}

class PaintCanvas extends Component<PaintCanvasProps, PaintCanvasState> {
  constructor(props: PaintCanvasProps) {
    super(props);
  }

  public state: PaintCanvasState = {
    points: [],
    intermediatePaths: [],
    finalPaths: []
  }

  private _pointsToSvgConverter = new _PointsToSvgConverter();
  
  private _panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      const newPoints = this.state.points;
      const newIntermediatePaths = this.state.intermediatePaths;
      
      const [x, y] = [e.nativeEvent.pageX, e.nativeEvent.pageY];
      newPoints.push({ x, y });

      newIntermediatePaths.push(
        <Circle 
          cx={`${this._pointsToSvgConverter
            .pointToSvgCircle(this.state.points[0]).x}`}
          cy={`${this._pointsToSvgConverter
            .pointToSvgCircle(this.state.points[0]).y}`}
          r={`${this.props.strokeSize / 2}`}
        />
      );
      
      this.setState({ points: newPoints });
    },
    onPanResponderMove: (e: GestureResponderEvent) => {
      const newPoints = this.state.points;
      const newIntermediatePaths = this.state.intermediatePaths;

      const [x, y] = [e.nativeEvent.pageX, e.nativeEvent.pageY];
      newPoints.push({ x, y });

      if (this.state.points.length > 1) {
        newIntermediatePaths.push(
          <Path
            d={this._pointsToSvgConverter.pointsToSvgPath(this.state.points)}
            stroke={this.props.color}
            strokeWidth={this.props.strokeSize}
            fill='none'
          />
        );
      } 

      this.setState({
        points: newPoints, 
        intermediatePaths: newIntermediatePaths
      });
    },
    onPanResponderRelease: () => {
      const newFinalPaths = this.state.finalPaths;

      if (this.state.points.length > 1) {
        newFinalPaths.push(
          <Path
            d={this._pointsToSvgConverter.pointsToSvgPath(this.state.points)}
            stroke={this.props.color}
            strokeWidth={this.props.strokeSize}
            fill='none'
          />
        );
      }

      if (this.state.points.length > 0) {
        newFinalPaths.push(
          <Circle 
            cx={`${this._pointsToSvgConverter
              .pointToSvgCircle(this.state.points[0]).x}`}
            cy={`${this._pointsToSvgConverter
              .pointToSvgCircle(this.state.points[0]).y}`}
            r={`${this.props.strokeSize / 2}`}
          />
        );
        newFinalPaths.push(
          <Circle 
            cx={`${this._pointsToSvgConverter
              .pointToSvgCircle(this.state.points[this.state.points.length - 1])
                .x}`}
            cy={`${this._pointsToSvgConverter
              .pointToSvgCircle(this.state.points[this.state.points.length - 1])
                .y}`}
            r={`${this.props.strokeSize / 2}`}
          />
        );
      }

      this.setState({
        points: [], 
        intermediatePaths: [], 
        finalPaths: newFinalPaths
      });
    },
  })

  public render() {
    return (
      <View
        onLayout={(e: LayoutChangeEvent) => 
          this._pointsToSvgConverter.setOffsets(e.nativeEvent.layout)}
        style={styles.paintContainer}
      >
        <View {...this._panResponder.panHandlers}>
          <Svg
            style={styles.paintSurface}
            width={this.props.width}
            height={this.props.height}
          >
            <G>{this.state.intermediatePaths}</G>
            <G>{this.state.finalPaths}</G>
          </Svg>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  paintContainer: {
    borderWidth: 0.5,
    borderColor: '#DDDDDD',
  },

  paintSurface: {
    backgroundColor: 'transparent',
  },
});

class _PointsToSvgConverter {
  private _offsetX: number = 0;
  private _offsetY: number = 0;

  public setOffsets(layout: LayoutRectangle): void {
    this._offsetX = layout.x;
    this._offsetY = layout.y;
  }

  public pointsToSvgPath(points: { x: number; y: number }[]): string {
    if (points.length > 0) {
      let path = 
        `M ${points[0].x - this._offsetX}, ${points[0].y - this._offsetY} S`;
      points.forEach((point: { x: number; y: number }) => {
        path = 
          `${path} ${point.x - this._offsetX}, ${point.y - this._offsetY} `;
      });
      return path;
    } else {
      return '';
    }
  }

  public pointToSvgCircle(
      point: { x: number; y: number }): { x: string; y: string } {
    return { x: `${point.x - this._offsetX}`, y: `${point.y - this._offsetY}` };
  }
}

export default PaintCanvas;
