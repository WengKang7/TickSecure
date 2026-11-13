import 'checkin_api.dart';

List<String> faceMovements(dynamic value) {
  if (value is! List || value.any((item) => item is! String)) {
    throw const CheckinException(
      'Start a new QR scan for guided face verification.',
    );
  }
  final steps = value.cast<String>();
  if (![
    'center,left,center,right,center',
    'center,right,center,left,center',
  ].contains(steps.join(','))) {
    throw const CheckinException(
      'The face movement request is invalid. Scan again.',
    );
  }
  return steps;
}

String faceInstruction(String step) => step == 'center'
    ? 'Look straight at the camera'
    : 'Turn slightly to your $step (about 20 degrees)';
