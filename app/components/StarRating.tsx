import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  spacing?: number;
  disabled?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRatingChange,
  size = 32,
  spacing = 8,
  disabled = false,
}) => {
  return (
    <View style={[styles.container, { gap: spacing }]}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          activeOpacity={0.7}
          disabled={disabled || !onRatingChange}
          onPress={() => onRatingChange && onRatingChange(star)}
          accessibilityRole="button"
          accessibilityLabel={`Calificar con ${star} estrellas`}
        >
          <MaterialCommunityIcons
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color={star <= rating ? "#E0A93F" : "#C4BDB5"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
