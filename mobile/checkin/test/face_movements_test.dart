import 'package:flutter_test/flutter_test.dart';
import 'package:ticksecure_checkin/face_movements.dart';

void main() {
  test(
    'guided capture requires server five-step sequence and readable prompts',
    () {
      for (final turns in [
        ['left', 'right'],
        ['right', 'left'],
      ]) {
        final sequence = ['center', turns[0], 'center', turns[1], 'center'];
        expect(faceMovements(sequence), sequence);
        expect(faceInstruction(turns[0]), contains(turns[0]));
      }
      expect(faceInstruction('center'), contains('straight'));
      for (final value in [
        null,
        [],
        ['center'],
        ['center', 'left', 'center', 'left', 'center'],
        [1, 2, 3, 4, 5],
      ]) {
        expect(() => faceMovements(value), throwsException);
      }
    },
  );
}
