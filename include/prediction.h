#pragma once
// One prediction: the class index and how sure the model is (0 to 1).
// FR-M4: Decision Tree = share of the predicted class among the training rows in the leaf;
//        KNN = share of the K nearest neighbours that voted for the predicted class.
struct Prediction {
    int label = 0;
    double confidence = 0.0;
};
