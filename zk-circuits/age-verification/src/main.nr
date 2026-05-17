use dep::std;

fn hash_birth_date(birth_date: Field) -> Field {
    std::hash::pedersen_commitment([birth_date])
}

fn compute_age(birth_date: Field, current_date: Field) -> Field {
    let years_from_epoch = 1970;
    let birth_year = birth_date / 10000;
    let birth_month = (birth_date / 100) % 100;
    let birth_day = birth_date % 100;

    let current_year = current_date / 10000;
    let current_month = (current_date / 100) % 100;
    let current_day = current_date % 100;

    let mut age = current_year - birth_year;

    if current_month < birth_month {
        age = age - 1;
    } else if current_month == birth_month {
        if current_day < birth_day {
            age = age - 1;
        }
    }

    age
}

fn main(
    birth_date: Field,
    current_date: Field,
    age_threshold: pub Field,
    verification_hash: pub Field,
) {
    let age = compute_age(birth_date, current_date);
    std::println(f"Computed age: {age}");
    std::println(f"Age threshold: {age_threshold}");

    assert(age >= age_threshold, "Age verification failed: below minimum age threshold");

    let computed_hash = std::hash::pedersen_commitment([
        birth_date,
        current_date,
    ]);
    std::println(f"Computed hash: {computed_hash}");
    std::println(f"Expected hash: {verification_hash}");

    assert(computed_hash == verification_hash, "Verification hash mismatch: birth_date and current_date do not match the provided hash");
}
