import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

type Props = { children: ReactNode; onBack?: () => void; onReport?: (error: unknown, info: ErrorInfo) => void };

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onReport?.(error, info);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg p-6">
        <Text variant="title" className="text-center">
          Something went wrong
        </Text>
        <Text tone="secondary" className="text-center">
          Your work is saved. Try again, or go back.
        </Text>
        <Button title="Try again" onPress={() => this.setState({ failed: false })} />
        {!!this.props.onBack && <Button title="Go back" variant="ghost" onPress={this.props.onBack} />}
      </View>
    );
  }
}
